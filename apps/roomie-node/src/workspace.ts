import {createHash} from 'node:crypto';
import {mkdir, realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {createStore} from 'zustand/vanilla';
import {createRoomShellSlice} from '@sqlrooms/room-shell';
import {
  createNodeDuckDbConnector,
  queryToArrowTable,
} from '@sqlrooms/duckdb-node';
import {createMosaicSlice} from '@sqlrooms/mosaic';
import {
  registerCommandsForOwner,
  invokeCommandWithPolicy,
  type RoomCommandResult,
} from '@sqlrooms/room-store';
import {z} from 'zod';
import {escapeVal} from '@sqlrooms/duckdb-core';
import {createRoomieDomainSlice} from '../../roomie-cli-ui/src/createRoomieDomainSlice';
import {selectRoomieContent} from '../../roomie-cli-ui/src/stateOwnership';
import type {RoomState} from '../../roomie-cli-ui/src/RoomState';
import {assertLocalRenderQuery} from '../../roomie-cli-ui/src/renderQueryPolicy';
import {createContent} from './content';
import {assertCommandTarget, createHostCommands} from './commands';
import {openMetadata, type CommitReceipt, type MetadataStore} from './metadata';

const activeDirectories = new Set<string>();
const Mutation = z.strictObject({
  operationId: z.string().min(1).max(200),
  principalId: z.string().min(1).max(200),
  commandId: z.string().min(1),
  input: z.record(z.string(), z.json()).default({}),
  artifactId: z.string().min(1).optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
});

/** A workspace-only command. Existing-document writes require a revision target. */
export type WorkspaceMutation = z.input<typeof Mutation>;
/** Structured conflict for a stale browser draft or agent operation. */
export type RevisionConflict = {
  success: false;
  code: 'revision-conflict';
  artifactId: string;
  currentRevision: number;
};

/**
 * Initialize the native database, metadata and recovered domain before exposing
 * any method. The returned facade is the only external access to workspace state.
 */
export async function openWorkspace(options: {
  directory: string;
  /** Explicit opt-in. Disabled means native DuckDB 2.0 without Quack. */
  quack?: {uri: string; token: string};
  /** Persistence boundary injection for deterministic storage failure tests. */
  openMetadata?: (path: string) => MetadataStore;
  /** Read-only analytical/file preparation. No tentative store is exposed. */
  prepareCommand?: (request: WorkspaceMutation) => Promise<void>;
}) {
  await mkdir(options.directory, {recursive: true});
  const directory = await realpath(options.directory);
  if (activeDirectories.has(directory))
    throw new Error('Workspace already has an active host.');
  activeDirectories.add(directory);
  const connector = createNodeDuckDbConnector({
    dbPath: join(directory, 'data.duckdb'),
    config: {storage_compatibility_version: 'v1.4.0'},
  });
  // DB services live independently of the disposable content projection. Their
  // methods must never close over a Zustand store discarded during recovery.
  const databaseStore = createStore(
    createRoomShellSlice({
      connector,
      config: {title: 'Roomie', dataSources: []},
    }),
  );
  let metadata: MetadataStore | undefined;
  let content: ReturnType<typeof createContent> | undefined;
  let store: ReturnType<typeof createDomain>;
  let closing = false;
  let fault: unknown;
  let queue: Promise<unknown> = Promise.resolve();
  const queries = new Set<
    Promise<Awaited<ReturnType<typeof queryToArrowTable>>>
  >();
  const mutations = new Set<Promise<CommitReceipt | RevisionConflict>>();
  let disposal: Promise<void> | undefined;
  const listeners = new Set<(receipt: CommitReceipt) => void>();
  let quackStarted = false;
  const unsubscribeDatabase = databaseStore.subscribe((state) => {
    store?.setState({db: state.db});
  });

  function createDomain() {
    const next = createStore<RoomState>()((set, get, api) => ({
      ...createRoomShellSlice({
        connector,
        config: {title: 'Roomie', dataSources: []},
      })(set, get, api),
      db: databaseStore.getState().db,
      ...createMosaicSlice()(set, get, api),
      ...createRoomieDomainSlice({}, false)(set, get, api),
    }));
    registerCommandsForOwner(next, 'roomie', createHostCommands());
    return next;
  }

  function gate<T>(work: () => T | Promise<T>, accepted = false): Promise<T> {
    if (closing && !accepted)
      return Promise.reject(new Error('Workspace is closing.'));
    const result = queue.then(() => {
      if (fault)
        throw new Error(
          'Workspace failed closed; reopen after resolving storage failure.',
          {cause: fault},
        );
      return work();
    });
    queue = result.catch(() => {});
    return result;
  }

  function rebuild() {
    content?.dispose();
    content = undefined;
    const next = createDomain();
    content = createContent(next, metadata!.load());
    store = next;
  }

  function publish(receipt: CommitReceipt) {
    for (const listener of listeners) {
      // Observer failure cannot turn a durable success into a rejected write.
      try {
        listener(structuredClone(receipt));
      } catch {
        /* Subscribers may reconnect/replay. */
      }
    }
  }

  try {
    // Native DuckDB's file lock excludes other host processes before SQLite opens.
    await connector.initialize();
    const version = await connector.queryJson<{version: string}>(
      'SELECT version() AS version',
    );
    if ([...version][0]?.version !== 'v2.0.0')
      throw new Error(
        'Roomie Node requires native DuckDB v2.0.0; refusing silent downgrade.',
      );
    metadata = (options.openMetadata ?? openMetadata)(
      join(directory, 'meta.sqlite'),
    );
    rebuild();
    metadata.runs.recover();
    await databaseStore.getState().db.refreshTableSchemas();
    if (options.quack) {
      const {uri, token} = options.quack;
      if (
        !/^quack:127\.0\.0\.1:\d+$/.test(uri) ||
        !/^[a-zA-Z0-9_-]{32,}$/.test(token)
      )
        throw new Error(
          'Quack requires a loopback URI and a token of at least 32 safe characters.',
        );
      await connector.execute('INSTALL quack; LOAD quack');
      await connector.execute(`CALL quack_serve('${uri}', token='${token}')`);
      quackStarted = true;
    }
  } catch (error) {
    unsubscribeDatabase();
    content?.dispose();
    metadata?.close();
    await connector.destroy();
    activeDirectories.delete(directory);
    throw error;
  }
  const persistence = metadata!;

  return {
    directory,
    runs: persistence.runs,
    engine: 'v2.0.0' as const,
    quack: quackStarted ? ('enabled' as const) : ('disabled' as const),
    ready: Promise.resolve(),
    /** Host catalog projection for read-only viewers; no arbitrary catalog SQL admission. */
    catalog: () => {
      const {tables, currentDatabase, currentSchema} =
        databaseStore.getState().db;
      return structuredClone({
        tables: tables
          .filter(
            (table) =>
              !(table.table.schema ?? '').startsWith('__') &&
              !table.table.table.startsWith('__'),
          )
          .map((value) => ({
            ...value,
            table: {
              database: value.table.database,
              schema: value.table.schema,
              table: value.table.table,
              defaultDatabase: value.table.defaultDatabase,
            },
          })),
        currentDatabase,
        currentSchema,
      });
    },
    /** Bounded analytical reads, drained before native instance shutdown. */
    query(sql: string, signal?: AbortSignal) {
      if (closing || fault || queries.size >= 4)
        return Promise.reject(
          new Error('Query service unavailable or at capacity.'),
        );
      const task = executeQuery(sql, signal);
      queries.add(task);
      void task.finally(() => queries.delete(task)).catch(() => {});
      return task;
    },
    /** Return committed content and revisions, never the live Zustand object. */
    snapshot: () =>
      gate(() => ({
        content: selectRoomieContent(store.getState()),
        revisions: Object.fromEntries(
          Object.keys(store.getState().blockDocuments.config.artifacts).map(
            (id) => [id, persistence.revision(id)],
          ),
        ),
        loro: content!.doc.export({mode: 'snapshot'}),
      })),
    /** Discover detached descriptors at the committed boundary. */
    listCommands: () =>
      gate(() =>
        structuredClone(
          store
            .getState()
            .commands.listCommands({
              surface: 'mcp',
              includeInputSchema: true,
              includeDisabled: true,
            })
            .filter((command) => command.owner === 'roomie'),
        ),
      ),
    /** Reads use the same registry and gate as content writes. */
    read: (commandId: string, input: Record<string, unknown> = {}) =>
      gate(async () => {
        const command = store.getState().commands.registry[commandId];
        if (!command?.metadata?.readOnly)
          throw new Error('Expected a read-only content command.');
        if (
          commandId !== 'block-document.list' &&
          typeof input.artifactId !== 'string'
        )
          throw new Error('An explicit artifactId is required.');
        const result = await invokeCommandWithPolicy(store, commandId, input, {
          surface: 'mcp',
        });
        return structuredClone({
          ...result,
          ...(typeof input.artifactId === 'string'
            ? {revision: persistence.revision(input.artifactId)}
            : {}),
        });
      }),
    /** Run preparation outside the content gate, then revision-check and commit. */
    mutate(raw: WorkspaceMutation): Promise<CommitReceipt | RevisionConflict> {
      if (closing) return Promise.reject(new Error('Workspace is closing.'));
      const mutation = executeMutation(raw);
      mutations.add(mutation);
      void mutation.finally(() => mutations.delete(mutation)).catch(() => {});
      return mutation;
    },
    /** Bounded committed audit replay. */
    events: (after = 0, limit = 100) =>
      gate(() => {
        z.number().int().nonnegative().parse(after);
        z.number().int().min(1).max(1000).parse(limit);
        return persistence.events(after, limit);
      }),
    subscribe(listener: (receipt: CommitReceipt) => void) {
      if (closing || fault) throw new Error('Workspace is unavailable.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Drain accepted preparations as well as the content commit queue. */
    async flush() {
      await Promise.allSettled([...mutations]);
      await gate(() => {});
    },
    dispose() {
      if (disposal) return disposal;
      closing = true;
      disposal = (async () => {
        await Promise.allSettled([...mutations]);
        await queue;
        await Promise.allSettled([...queries]);
        listeners.clear();
        unsubscribeDatabase();
        content?.dispose();
        try {
          if (quackStarted)
            await connector.execute(`CALL quack_stop('${options.quack!.uri}')`);
        } finally {
          try {
            persistence.close();
          } finally {
            try {
              await connector.destroy();
            } finally {
              activeDirectories.delete(directory);
            }
          }
        }
      })();
      return disposal;
    },
  };

  async function executeQuery(sql: string, signal?: AbortSignal) {
    if (signal?.aborted) throw new Error('Query cancelled.');
    const connection = await connector.getInstance().connect();
    let expired = false;
    const abort = () => connection.interrupt();
    signal?.addEventListener('abort', abort, {once: true});
    const timer = setTimeout(() => {
      expired = true;
      abort();
    }, 30000);
    const query = async (text: string) => {
      if (signal?.aborted || expired)
        throw new Error('Query cancelled or deadline exceeded.');
      return queryToArrowTable(connection, text);
    };
    // Validation and execution share this request's interruptible connection.
    const policyConnector = new Proxy(
      {...connector},
      {
        get(target, key) {
          return key === 'query' ? query : Reflect.get(target, key);
        },
      },
    );
    try {
      // Mosaic asks for DESCRIBE metadata. Validate its underlying SELECT before
      // DuckDB binds it; DESCRIBE must never become a file/table-function bypass.
      const describe = /^\s*(?:DESCRIBE|DESC)\s+([\s\S]+)$/i.exec(sql);
      const inspectedSql = describe
        ? /^\s*(?:SELECT|WITH)\b/i.test(describe[1]!)
          ? describe[1]!
          : `SELECT * FROM ${describe[1]}`
        : sql;
      await assertLocalRenderQuery(
        {
          ...databaseStore.getState().db,
          getConnector: async () => policyConnector,
          sqlSelectToJson: async (text) =>
            JSON.parse(
              (await query(`SELECT json_serialize_sql(${escapeVal(text)})`))
                .getChildAt(0)!
                .get(0),
            ),
        },
        inspectedSql,
      );
      return await query(sql);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      connection.closeSync();
    }
  }

  async function executeMutation(
    raw: WorkspaceMutation,
  ): Promise<CommitReceipt | RevisionConflict> {
    const request = Mutation.parse(raw);
    const requestHash = createHash('sha256')
      .update(canonicalJson(request))
      .digest('hex');
    // Receipt lookup precedes even preparation: a committed retry must not
    // depend on a table or document still existing at its original revision.
    const prior = await gate(() =>
      persistence.receipt(request.operationId, requestHash),
    );
    if (prior) return prior;
    // Analytical/catalog work must not hold up content snapshots and MCP reads.
    await options.prepareCommand?.(structuredClone(request));
    await databaseStore.getState().db.refreshTableSchemas();
    return gate(async () => {
      const prior = persistence.receipt(request.operationId, requestHash);
      if (prior) return prior;
      const creating = request.commandId === 'block-document.create';
      const command = store.getState().commands.registry[request.commandId];
      if (!command || command.metadata?.readOnly)
        throw new Error('Expected a mutating content command.');
      if (creating) {
        if (
          request.artifactId !== undefined ||
          request.expectedRevision !== undefined
        )
          throw new Error(
            'Creation uses its operation ID, without an existing revision target.',
          );
      } else {
        if (
          request.artifactId === undefined ||
          request.expectedRevision === undefined
        )
          throw new Error(
            'Existing-document mutations require artifactId and expectedRevision.',
          );
        assertCommandTarget(
          store.getState(),
          request.commandId,
          request.input,
          request.artifactId,
        );
        const currentRevision = persistence.revision(request.artifactId);
        if (request.expectedRevision !== currentRevision)
          return {
            success: false,
            code: 'revision-conflict',
            artifactId: request.artifactId,
            currentRevision,
          };
      }
      const from = content!.hasHistory
        ? content!.doc.oplogVersion()
        : undefined;
      let receipt: CommitReceipt;
      try {
        const result: RoomCommandResult = await invokeCommandWithPolicy(
          store,
          request.commandId,
          request.input,
          {surface: 'mcp', actor: request.principalId},
        );
        if (!result.success)
          throw Object.assign(new Error(result.error ?? 'Command failed.'), {
            code: result.code,
            details: result.data,
          });
        const artifactId = creating
          ? (result.data as {artifactId: string}).artifactId
          : request.artifactId!;
        // Host view state always stays at its default. It is never published.
        store.getState().artifacts.setCurrentArtifact(undefined);
        content!.push();
        // Return the same JSON value both now and when replaying the receipt.
        receipt = JSON.parse(
          JSON.stringify({
            operationId: request.operationId,
            artifactId,
            revision: persistence.revision(artifactId) + 1,
            result,
          }),
        );
        await persistence.commit({
          receipt,
          requestHash,
          update: content!.doc.export({mode: 'update', from}),
          commandId: request.commandId,
          principalId: request.principalId,
        });
      } catch (error) {
        try {
          const committed = persistence.resolveReceipt(
            request.operationId,
            requestHash,
          );
          // Rebind both mirror and projection even after an uncertain success.
          rebuild();
          if (committed) {
            publish(committed);
            return committed;
          }
        } catch (recoveryError) {
          fault = recoveryError;
          throw new Error(
            'Cannot establish durable state; workspace failed closed.',
            {cause: recoveryError},
          );
        }
        throw error;
      }
      content!.hasHistory = true;
      publish(receipt);
      return structuredClone(receipt);
    }, true);
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
