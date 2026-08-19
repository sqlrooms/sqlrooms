import type {RoomCapability, RoomCapabilityContext} from '@sqlrooms/mcp';
import {
  arrowTableToJson,
  type DataTable,
  getTableDisplayName,
  getTableIdentity,
  resolveTableReference,
} from '@sqlrooms/duckdb';
import {invokeCommandWithPolicy} from '@sqlrooms/room-shell';
import type {
  RoomCommandDescriptor,
  RoomCommandResult,
} from '@sqlrooms/room-shell';
import {likePatternToRegex} from './mcpCapabilityUtils';
import {roomStore} from './store';

const DEFAULT_QUERY_ROWS = 200;
const MAX_QUERY_ROWS = 1_000;
const MAX_LISTED_TABLES = 1_000;
const INTERNAL_SQLROOMS_PREFIX = '__sqlrooms';
const MCP_EXCLUDED_COMMAND_IDS = new Set([
  'db.create-table-from-query',
  'room.add-sql-data-source',
  'sql-editor.run-current-query',
  'sql-editor.run-query',
]);
let commandInvocationQueue = Promise.resolve();

type CreateCliRoomCapabilitiesOptions = {
  metaNamespace?: string;
};

export function createCliRoomCapabilities({
  metaNamespace = '__sqlrooms',
}: CreateCliRoomCapabilitiesOptions = {}): RoomCapability[] {
  return [
    createQueryCapability(metaNamespace),
    createListTablesCapability(metaNamespace),
    createReadTableSchemaCapability(metaNamespace),
    createSearchCommandsCapability(),
    createGetCommandCapability(),
    createExecuteCommandCapability(),
  ];
}

function createQueryCapability(metaNamespace: string): RoomCapability {
  return {
    name: 'query',
    title: 'Query the room database',
    description:
      'Run one user-approved SQL SELECT query against the live room and return bounded JSON rows. SELECT validation is not a host sandbox.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: {type: 'string', minLength: 1},
        maxRows: {
          type: 'integer',
          minimum: 1,
          maximum: MAX_QUERY_ROWS,
          default: DEFAULT_QUERY_ROWS,
        },
      },
      required: ['sql'],
      additionalProperties: false,
    },
    annotations: {untrustedContentHint: true},
    execute: async (rawInput, context) => {
      const input = rawInput as {sql: string; maxRows?: number};
      const sql = input.sql.trim();
      const maxRows = Math.min(
        MAX_QUERY_ROWS,
        Math.max(1, Math.floor(input.maxRows ?? DEFAULT_QUERY_ROWS)),
      );
      const state = roomStore.getState();
      const parsed = await state.db.sqlSelectToJson(sql);
      const parseError = parsed.error ? parsed.error_message : undefined;
      if (
        parsed.error ||
        parsed.statements.length !== 1 ||
        parsed.statements[0]?.node.type !== 'SELECT_NODE'
      ) {
        return {
          ok: false,
          code: 'query_not_readonly',
          message: parseError || 'Only one SELECT statement is allowed.',
        };
      }
      const namespaceReference = findInternalNamespaceReference(
        parsed.statements,
        metaNamespace,
      );
      if (namespaceReference === 'internal') {
        return {
          ok: false,
          code: 'query_internal_namespace',
          message: `Access to internal schema ${metaNamespace} is denied.`,
        };
      }
      if (namespaceReference === 'dynamic') {
        return {
          ok: false,
          code: 'query_dynamic_table_reference',
          message:
            'Dynamic query and table references are not allowed over MCP.',
        };
      }
      try {
        const connector = await state.db.getConnector();
        const boundedSql = sql.replace(/;+\s*$/, '');
        const result = await connector.query(
          `SELECT * FROM (\n${boundedSql}\n) AS sqlrooms_mcp_query LIMIT ${maxRows + 1}`,
          {signal: context.signal},
        );
        const rows = arrowTableToJson(result);
        const truncated = rows.length > maxRows;
        if (truncated) rows.length = maxRows;
        return {
          ok: true,
          data: {
            rows,
            rowCount: rows.length,
            truncated,
            maxRows,
          },
        };
      } catch (error) {
        return {
          ok: false,
          code: context.signal?.aborted ? 'cancelled' : 'query_failed',
          message: error instanceof Error ? error.message : 'Query failed.',
          retryable: Boolean(context.signal?.aborted),
        };
      }
    },
  };
}

function findInternalNamespaceReference(
  statements: unknown[],
  namespace: string,
): 'internal' | 'dynamic' | undefined {
  const normalizedNamespace = namespace.toLowerCase();
  let result: 'internal' | 'dynamic' | undefined;

  const visit = (value: unknown): void => {
    if (result === 'internal' || value === null || typeof value !== 'object') {
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }

    const node = value as Record<string, unknown>;
    if (node.type === 'BASE_TABLE') {
      const identifiers = [node.catalog_name, node.schema_name];
      if (
        identifiers.some(
          (identifier) =>
            typeof identifier === 'string' &&
            identifier.toLowerCase() === normalizedNamespace,
        )
      ) {
        result = 'internal';
        return;
      }
    }
    if (node.type === 'TABLE_FUNCTION') {
      const tableFunction = node.function;
      if (tableFunction && typeof tableFunction === 'object') {
        const functionName = (tableFunction as Record<string, unknown>)
          .function_name;
        if (
          typeof functionName === 'string' &&
          (functionName.toLowerCase() === 'query' ||
            functionName.toLowerCase() === 'query_table')
        ) {
          result = 'dynamic';
        }
      }
    }

    for (const child of Object.values(node)) visit(child);
  };

  visit(statements);
  return result;
}

function createListTablesCapability(metaNamespace: string): RoomCapability {
  return {
    name: 'list_tables',
    title: 'List room tables',
    description:
      'List visible tables and views with canonical table IDs for follow-up calls.',
    inputSchema: {
      type: 'object',
      properties: {
        database: {type: 'string'},
        schema: {type: 'string'},
        pattern: {type: 'string', maxLength: 200},
        includeViews: {type: 'boolean', default: true},
      },
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true, untrustedContentHint: true},
    execute: async (rawInput) => {
      const input = rawInput as {
        database?: string;
        schema?: string;
        pattern?: string;
        includeViews?: boolean;
      };
      let tables = await refreshVisibleTables(metaNamespace);
      if (input.database) {
        tables = tables.filter(
          (table) => table.table.database === input.database,
        );
      }
      if (input.schema) {
        tables = tables.filter((table) => table.table.schema === input.schema);
      }
      if (input.includeViews === false) {
        tables = tables.filter((table) => !table.isView);
      }
      if (input.pattern) {
        const pattern = likePatternToRegex(input.pattern);
        tables = tables.filter((table) => pattern.test(table.table.table));
      }
      const summaries = tables
        .map((table) => ({
          tableId: getTableIdentity(table.table),
          database: table.table.database,
          schema: table.table.schema,
          tableName: getTableDisplayName(table.table),
          isView: table.isView,
          columnCount: table.columns.length,
          rowCount: table.rowCount,
        }))
        .sort((first, second) => first.tableId.localeCompare(second.tableId));
      const totalCount = summaries.length;
      const boundedSummaries = summaries.slice(0, MAX_LISTED_TABLES);
      return {
        ok: true,
        data: {
          tables: boundedSummaries,
          totalCount,
          truncated: totalCount > boundedSummaries.length,
        },
      };
    },
  };
}

function createReadTableSchemaCapability(
  metaNamespace: string,
): RoomCapability {
  return {
    name: 'read_table_schema',
    title: 'Read a table schema',
    description:
      'Read column metadata and the optional CREATE statement for one visible table or view.',
    inputSchema: {
      type: 'object',
      properties: {tableId: {type: 'string', minLength: 1}},
      required: ['tableId'],
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true, untrustedContentHint: true},
    execute: async (rawInput) => {
      const {tableId} = rawInput as {tableId: string};
      const visibleTables = await refreshVisibleTables(metaNamespace);
      const resolution = resolveTableReference(visibleTables, tableId);
      if (resolution.ambiguousMatches) {
        return {
          ok: false,
          code: 'table_ambiguous',
          message: `Table "${tableId}" is ambiguous.`,
          details: {
            matches: resolution.ambiguousMatches.map((table) =>
              getTableIdentity(table.table),
            ),
          },
        };
      }
      const table = resolution.table;
      if (!table) {
        return {
          ok: false,
          code: 'table_not_found',
          message: `Table "${tableId}" was not found.`,
        };
      }
      return {
        ok: true,
        data: {
          table: {
            id: getTableIdentity(table.table),
            name: getTableDisplayName(table.table),
            database: table.table.database,
            schema: table.table.schema,
            isView: table.isView,
            rowCount: table.rowCount,
            columns: table.columns.map((column) => ({
              name: column.name,
              type: column.type,
            })),
            ...(table.sql ? {createStatement: table.sql} : {}),
          },
        },
      };
    },
  };
}

async function refreshVisibleTables(
  metaNamespace: string,
): Promise<DataTable[]> {
  await roomStore.getState().db.refreshTableSchemas();
  return roomStore.getState().db.tables.filter((table) => {
    const {database, schema, table: tableName} = table.table;
    const identifiers = [database, schema, tableName];
    return (
      !identifiers.some((identifier) =>
        identifier?.startsWith(INTERNAL_SQLROOMS_PREFIX),
      ) &&
      database !== metaNamespace &&
      schema !== metaNamespace
    );
  });
}

function createSearchCommandsCapability(): RoomCapability {
  return {
    name: 'search_commands',
    title: 'Search room commands',
    description:
      'Search the live command registry by intent, then inspect a selected command with get_command.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {type: 'string', default: ''},
        limit: {type: 'integer', minimum: 1, maximum: 50, default: 10},
      },
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true},
    execute: (rawInput, context) => {
      const input = rawInput as {query?: string; limit?: number};
      const query = input.query?.trim().toLowerCase() ?? '';
      const limit = Math.min(50, Math.max(1, input.limit ?? 10));
      const commands = listMcpCommands(context)
        .map((descriptor) => ({
          descriptor,
          score: scoreCommand(descriptor, query),
        }))
        .filter((entry) => !query || entry.score > 0)
        .sort(
          (first, second) =>
            second.score - first.score ||
            first.descriptor.id.localeCompare(second.descriptor.id),
        )
        .slice(0, limit)
        .map(({descriptor, score}) => ({
          id: descriptor.id,
          name: descriptor.name,
          description: descriptor.description,
          group: descriptor.group,
          enabled: descriptor.enabled,
          riskLevel: descriptor.riskLevel,
          requiresConfirmation: descriptor.requiresConfirmation,
          score,
        }));
      return {ok: true, data: {commands}};
    },
  };
}

function createGetCommandCapability(): RoomCapability {
  return {
    name: 'get_command',
    title: 'Inspect a room command',
    description:
      'Get the current portable schema, availability, and risk metadata for one command.',
    inputSchema: {
      type: 'object',
      properties: {commandId: {type: 'string', minLength: 1}},
      required: ['commandId'],
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true},
    execute: (rawInput, context) => {
      const {commandId} = rawInput as {commandId: string};
      const command = listMcpCommands(context, true).find(
        (descriptor) => descriptor.id === commandId,
      );
      return command
        ? {ok: true, data: {command}}
        : {
            ok: false,
            code: 'command_not_found',
            message: `Unknown command "${commandId}".`,
          };
    },
  };
}

function createExecuteCommandCapability(): RoomCapability {
  return {
    name: 'execute_command',
    title: 'Execute a room command',
    description:
      'Execute one enabled command against the live room. High-risk and confirmation-gated commands are denied in this release.',
    inputSchema: {
      type: 'object',
      properties: {
        commandId: {type: 'string', minLength: 1},
        input: {},
      },
      required: ['commandId'],
      additionalProperties: false,
    },
    annotations: {destructiveHint: true},
    execute: async (rawInput, context) => {
      const {commandId, input} = rawInput as {
        commandId: string;
        input?: unknown;
      };
      const command = listMcpCommands(context).find(
        (descriptor) => descriptor.id === commandId,
      );
      if (!command) {
        return {
          ok: false,
          code: 'command_not_found',
          message: `Unknown command "${commandId}".`,
        };
      }
      const result = await enqueueCommandInvocation(
        commandId,
        () =>
          invokeCommandWithPolicy(
            roomStore,
            commandId,
            input,
            {
              surface: 'mcp',
              actor: context.actor,
              traceId: context.traceId,
              metadata: {
                ...(context.metadata ?? {}),
                mcpRequestId: context.requestId,
                mcpClientInfo: context.clientInfo,
              },
              signal: context.signal,
            },
            {confirmed: false},
          ),
        context.signal,
      );
      if (result.success) {
        return {
          ok: true,
          message: result.message,
          data: {commandId, code: result.code, data: result.data},
        };
      }
      const confirmationRequired =
        result.code === 'command-confirmation-required';
      return {
        ok: false,
        code: result.code ?? 'command_failed',
        message: result.error ?? result.message ?? 'Command execution failed.',
        details: result.data,
        ...(confirmationRequired
          ? {
              inputRequired: {
                reason: 'confirmation',
                commandId,
                message:
                  'This command is excluded from external execution until interoperable confirmation is enabled.',
              },
            }
          : {}),
      };
    },
  };
}

function listMcpCommands(
  context: RoomCapabilityContext,
  includeInputSchema = false,
) {
  return roomStore
    .getState()
    .commands.listCommands({
      surface: 'mcp',
      actor: context.actor,
      traceId: context.traceId,
      metadata: context.metadata,
      includeInvisible: false,
      includeDisabled: true,
      includeInputSchema,
    })
    .filter((command) => !MCP_EXCLUDED_COMMAND_IDS.has(command.id));
}

function scoreCommand(command: RoomCommandDescriptor, query: string) {
  if (!query) return 1;
  const terms = query.split(/\s+/).filter(Boolean);
  const id = command.id.toLowerCase();
  const name = command.name.toLowerCase();
  const description = command.description?.toLowerCase() ?? '';
  const keywords = command.keywords?.join(' ').toLowerCase() ?? '';
  return terms.reduce((score, term) => {
    if (id === term) return score + 20;
    if (id.includes(term)) return score + 10;
    if (name.includes(term)) return score + 6;
    if (keywords.includes(term)) return score + 4;
    if (description.includes(term)) return score + 2;
    return score;
  }, 0);
}

function cancelledCommandResult(commandId: string): RoomCommandResult {
  return {
    success: false,
    commandId,
    code: 'command-cancelled',
    error: 'Command execution was cancelled.',
  };
}

function enqueueCommandInvocation(
  commandId: string,
  invoke: () => Promise<RoomCommandResult>,
  signal?: AbortSignal,
): Promise<RoomCommandResult> {
  const waitForTurn = commandInvocationQueue;
  let releaseTurn!: () => void;
  const turnFinished = new Promise<void>((resolve) => {
    releaseTurn = resolve;
  });
  commandInvocationQueue = waitForTurn.then(() => turnFinished);

  return waitForTurn.then(async () => {
    if (signal?.aborted) {
      releaseTurn();
      return cancelledCommandResult(commandId);
    }

    const invocation = Promise.resolve().then(invoke);
    void invocation.then(releaseTurn, releaseTurn);
    if (!signal) {
      return await invocation;
    }

    let onAbort: (() => void) | undefined;
    const aborted = new Promise<RoomCommandResult>((resolve) => {
      onAbort = () => resolve(cancelledCommandResult(commandId));
      signal.addEventListener('abort', onAbort, {once: true});
      if (signal.aborted) {
        onAbort();
      }
    });
    try {
      return await Promise.race([invocation, aborted]);
    } finally {
      if (onAbort) {
        signal.removeEventListener('abort', onAbort);
      }
    }
  });
}
