import {createId} from '@paralleldrive/cuid2';
import {
  isWasmDuckDbConnector,
  type DuckDbConnector,
  type DuckDbSliceState,
} from '@sqlrooms/duckdb';
import {
  BaseRoomStoreState,
  createSlice,
  useBaseRoomStore,
  type SliceFunctions,
  type StateCreator,
} from '@sqlrooms/room-store';
import type {
  ArrowQueryRequest,
  ConnectorQueryRequest,
  ExecQueryRequest,
  JSONQueryRequest,
} from '@uwdata/mosaic-core';
import {
  Connector,
  Coordinator,
  coordinator,
  makeClient,
  Selection,
  wasmConnector,
} from '@uwdata/mosaic-core';
import {Query} from '@uwdata/mosaic-sql';
import type {Table as ArrowTable} from 'apache-arrow';
import {produce} from 'immer';
import {z} from 'zod';
import {
  createMosaicTableFromArrowTable,
  toArrowClientResult,
} from './tableInterop';

export const MosaicSliceConfig = z.object({});
export type MosaicSliceConfig = z.infer<typeof MosaicSliceConfig>;

export type MosaicPreAggregateOptions = {
  /** Database schema/namespace for Mosaic pre-aggregate tables. */
  schema?: string;
  /** Enable or disable Mosaic's pre-aggregation optimization. */
  enabled?: boolean;
};

// Client configuration options
export type MosaicClientOptions = {
  /** Unique identifier for this client */
  id?: string;
  /** Selection name for cross-filtering (will create if doesn't exist) */
  selectionName?: string;
  /** The selection to subscribe to for cross-filtering */
  selection?: Selection;
  /** Query builder function that receives the current filter */
  query: (filter: unknown) => ReturnType<typeof Query.from>;
  /** Callback when query results are received */
  queryResult?: (result: ArrowTable) => void;
  /** Callback when query execution fails */
  queryError?: (error: Error) => void;
};

// Tracked client info
export type TrackedClient = {
  id: string;
  client: ReturnType<typeof makeClient>;
  createdAt: number;
  isLoading: boolean;
  data: unknown | null;
  error?: Error;
  selection?: Selection; // Track for change detection
  queryResultCallback?: (result: ArrowTable) => void; // External callback
};

export type MosaicIdleConnection = {status: 'idle'};
export type MosaicLoadingConnection = {status: 'loading'};
export type MosaicReadyConnection = {
  status: 'ready';
  connector?: Connector;
  coordinator: Coordinator;
};
export type MosaicErrorConnection = {status: 'error'; error: unknown};

export type MosaicConnection =
  | MosaicIdleConnection
  | MosaicLoadingConnection
  | MosaicReadyConnection
  | MosaicErrorConnection;

export type ConnectionStatus = MosaicConnection['status'];

export type MosaicSliceState = {
  mosaic: SliceFunctions & {
    connection: MosaicConnection;
    config: MosaicSliceConfig;
    /** Record of registered clients by id */
    clients: Record<string, TrackedClient>;
    /** Named selections for cross-filtering (e.g., 'brush', 'hover') */
    selections: Record<string, Selection>;
    initialize: () => Promise<void>;
    /** Get or create a named selection for cross-filtering */
    getSelection: (
      name: string,
      type?: 'crossfilter' | 'single' | 'union',
    ) => Selection;
    /** Create a mosaic client and register it */
    createClient: (options: MosaicClientOptions) => string;
    /** Ensure a client exists with given options (idempotent - creates or updates as needed) */
    ensureClient: (
      options: MosaicClientOptions & {
        id: string;
        onQueryResult?: (result: ArrowTable) => void;
        onQueryError?: (error: Error) => void;
      },
    ) => void;
    /** Disconnect and remove a client by id */
    destroyClient: (id: string) => void;
    /** Disconnect all clients (useful for cleanup) */
    destroyAllClients: () => void;
  };
};

export function createDefaultMosaicConfig(
  props?: Partial<MosaicSliceConfig>,
): MosaicSliceConfig {
  return {...props} as MosaicSliceConfig;
}

type CreateMosaicSliceBaseProps = {
  config?: Partial<MosaicSliceConfig>;
  preagg?: MosaicPreAggregateOptions;
};

/** Configure Mosaic with a caller-supplied coordinator and no database slice. */
export type CreateCoordinatorMosaicSliceProps = CreateMosaicSliceBaseProps & {
  coordinator: Coordinator;
};

/** Configure Mosaic to create its coordinator from the room's DuckDB slice. */
export type CreateDuckDbMosaicSliceProps = CreateMosaicSliceBaseProps & {
  coordinator?: never;
};

export type CreateMosaicSliceProps =
  | CreateCoordinatorMosaicSliceProps
  | CreateDuckDbMosaicSliceProps;

type CoordinatorMosaicStoreState = BaseRoomStoreState & MosaicSliceState;
type DuckDbMosaicStoreState = CoordinatorMosaicStoreState & DuckDbSliceState;

/**
 * Create a Mosaic slice backed by a supplied coordinator.
 *
 * This mode does not require a DuckDB slice in the room store.
 */
export function createMosaicSlice(
  props: CreateCoordinatorMosaicSliceProps,
): StateCreator<CoordinatorMosaicStoreState, [], [], MosaicSliceState>;

/**
 * Create a Mosaic slice backed by the room's DuckDB connector.
 *
 * The room store must include a DuckDB slice when no coordinator is supplied.
 */
export function createMosaicSlice(
  props?: CreateDuckDbMosaicSliceProps,
): StateCreator<DuckDbMosaicStoreState, [], [], MosaicSliceState>;

export function createMosaicSlice(props: CreateMosaicSliceProps = {}) {
  return createSlice<
    MosaicSliceState,
    CoordinatorMosaicStoreState & Partial<DuckDbSliceState>
  >((set, get, store) => ({
    mosaic: {
      config: createDefaultMosaicConfig(props?.config),
      connection: {status: 'idle'},
      clients: {},
      selections: {},

      async initialize() {
        let mosaicConnector: Connector | undefined;
        let resolvedCoordinator!: Coordinator;
        set((state) =>
          produce(state, (draft) => {
            draft.mosaic.connection = {status: 'loading'};
          }),
        );
        try {
          if (props.coordinator) {
            resolvedCoordinator = props.coordinator;
            applyMosaicPreAggregateOptions(resolvedCoordinator, props.preagg);
          } else {
            const db = get().db;
            if (!db) {
              throw new Error(
                'createMosaicSlice() requires a DuckDB slice when no coordinator is supplied. Pass a coordinator or include a database slice in the room store.',
              );
            }
            const dbConnector = await db.getConnector();
            resolvedCoordinator = coordinator();
            mosaicConnector = isWasmDuckDbConnector(dbConnector)
              ? await wasmConnector({
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore - We might be using a different version of duckdb-wasm than mosaic expects
                  duckDb: dbConnector.getDb(),
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore - same version mismatch
                  connection: dbConnector.getConnection(),
                })
              : createDuckDbMosaicConnector(dbConnector);
            applyMosaicPreAggregateOptions(resolvedCoordinator, props.preagg);
            resolvedCoordinator.databaseConnector(mosaicConnector);
          }
        } catch (error) {
          set((state) =>
            produce(state, (draft) => {
              draft.mosaic.connection = {status: 'error', error};
            }),
          );
          throw error;
        }
        set((state) =>
          produce(state, (draft) => {
            draft.mosaic.connection = {
              status: 'ready',
              connector: mosaicConnector,
              coordinator: resolvedCoordinator,
            };
          }),
        );
      },

      async destroy() {
        get().mosaic.destroyAllClients();
      },

      setConfig(config: MosaicSliceConfig) {
        set((state) =>
          produce(state, (draft) => {
            draft.mosaic.config = config;
          }),
        );
      },

      getSelection(
        name: string,
        type: 'crossfilter' | 'single' | 'union' = 'crossfilter',
      ) {
        const existing = get().mosaic.selections[name];
        if (existing) return existing;

        const selection =
          type === 'crossfilter'
            ? Selection.crossfilter()
            : type === 'single'
              ? Selection.single()
              : Selection.union();

        set((state) =>
          produce(state, (draft) => {
            draft.mosaic.selections[name] = selection;
          }),
        );
        return selection;
      },

      createClient(options: MosaicClientOptions) {
        const {connection} = get().mosaic;
        if (connection.status !== 'ready') {
          throw new Error('Mosaic connection not ready');
        }

        const id = options.id ?? createId();

        // Determine which selection to use
        const selection =
          options.selection ??
          (options.selectionName
            ? get().mosaic.getSelection(options.selectionName)
            : undefined);

        // Wrap queryResult to update store state AND call external callback
        const wrappedQueryResult = (data: unknown) => {
          set((state) =>
            produce(state, (draft) => {
              const tracked = draft.mosaic.clients[id];
              if (tracked) {
                tracked.data = data;
                tracked.isLoading = false;
                tracked.error = undefined;
              }
            }),
          );
          // Call external callback if provided
          options.queryResult?.(toArrowClientResult(data));
        };
        const wrappedQueryPending = () => {
          set((state) =>
            produce(state, (draft) => {
              const tracked = draft.mosaic.clients[id];
              if (tracked) {
                tracked.isLoading = true;
                tracked.error = undefined;
              }
            }),
          );
        };
        const wrappedQueryError = (error: Error) => {
          set((state) =>
            produce(state, (draft) => {
              const tracked = draft.mosaic.clients[id];
              if (tracked) {
                tracked.isLoading = false;
                tracked.error = error;
              }
            }),
          );
          // Disable client to prevent further queries
          client.enabled = false;
          options.queryError?.(error);
        };

        const client = makeClient({
          coordinator: connection.coordinator,
          selection,
          query: options.query,
          queryResult: wrappedQueryResult,
          queryPending: wrappedQueryPending,
          queryError: wrappedQueryError,
        });

        set((state) =>
          produce(state, (draft) => {
            draft.mosaic.clients[id] = {
              id,
              client,
              createdAt: Date.now(),
              isLoading: true,
              data: null,
              error: undefined,
              selection,
              queryResultCallback: options.queryResult
                ? (result: unknown) =>
                    options.queryResult!(toArrowClientResult(result))
                : undefined,
            };
          }),
        );

        return id;
      },

      ensureClient(
        options: MosaicClientOptions & {
          id: string;
          onQueryResult?: (result: ArrowTable) => void;
          onQueryError?: (error: Error) => void;
        },
      ) {
        const {connection, clients} = get().mosaic;
        if (connection.status !== 'ready') {
          return; // Silently return if not ready - hook will handle retry
        }

        const existing = clients[options.id];

        // Determine which selection to use
        const selection =
          options.selection ??
          (options.selectionName
            ? get().mosaic.getSelection(options.selectionName)
            : undefined);

        // Check if client exists and selection matches
        // Note: If query or callback changes, we recreate the client to ensure
        // the latest versions are used. This is simpler than trying to update
        // the bound queryResult callback in makeClient.
        if (existing && existing.selection === selection) {
          return; // No-op - client already exists with same selection
        }

        // If exists but selection changed, destroy it first
        if (existing) {
          get().mosaic.destroyClient(options.id);
        }

        // Create new client with wrapped queryResult that calls both store update and external callback
        const wrappedQueryResult = (data: unknown) => {
          set((state) =>
            produce(state, (draft) => {
              const tracked = draft.mosaic.clients[options.id];
              if (tracked) {
                tracked.data = data;
                tracked.isLoading = false;
                tracked.error = undefined;
              }
            }),
          );
          const arrowData = toArrowClientResult(data);
          // Call external callback if provided
          options.onQueryResult?.(arrowData);
          // Also call original queryResult if provided
          options.queryResult?.(arrowData);
        };
        const wrappedQueryPending = () => {
          set((state) =>
            produce(state, (draft) => {
              const tracked = draft.mosaic.clients[options.id];
              if (tracked) {
                tracked.isLoading = true;
                tracked.error = undefined;
              }
            }),
          );
        };
        const wrappedQueryError = (error: Error) => {
          set((state) =>
            produce(state, (draft) => {
              const tracked = draft.mosaic.clients[options.id];
              if (tracked) {
                tracked.isLoading = false;
                tracked.error = error;
              }
            }),
          );
          // Disable client to prevent further queries
          client.enabled = false;
          options.onQueryError?.(error);
          options.queryError?.(error);
        };

        const client = makeClient({
          coordinator: connection.coordinator,
          selection,
          query: options.query,
          queryResult: wrappedQueryResult,
          queryPending: wrappedQueryPending,
          queryError: wrappedQueryError,
        });

        set((state) =>
          produce(state, (draft) => {
            draft.mosaic.clients[options.id] = {
              id: options.id,
              client,
              createdAt: Date.now(),
              isLoading: true,
              data: null,
              error: undefined,
              selection,
              queryResultCallback: options.onQueryResult
                ? (result: unknown) =>
                    options.onQueryResult!(toArrowClientResult(result))
                : undefined,
            };
          }),
        );
      },

      destroyClient(id: string) {
        const {clients} = get().mosaic;
        const tracked = clients[id];
        if (!tracked) return;

        tracked.client.destroy();

        set((state) =>
          produce(state, (draft) => {
            delete draft.mosaic.clients[id];
          }),
        );
      },

      destroyAllClients() {
        const {clients} = get().mosaic;
        Object.values(clients).forEach((tracked) => {
          tracked.client.destroy();
        });

        set((state) =>
          produce(state, (draft) => {
            draft.mosaic.clients = {};
          }),
        );
      },
    },
  }));
}

function applyMosaicPreAggregateOptions(
  mosaicCoordinator: Coordinator,
  options?: MosaicPreAggregateOptions,
) {
  if (!options) {
    return;
  }
  if (options.schema !== undefined) {
    mosaicCoordinator.preaggregator.schema = options.schema;
  }
  if (options.enabled !== undefined) {
    mosaicCoordinator.preaggregator.enabled = options.enabled;
  }
}

export type DuckDbSliceStateWithMosaic = DuckDbSliceState & MosaicSliceState;

export function useStoreWithMosaic<T>(
  selector: (state: DuckDbSliceStateWithMosaic) => T,
): T {
  return useBaseRoomStore<BaseRoomStoreState, T>((state) =>
    selector(state as unknown as DuckDbSliceStateWithMosaic),
  );
}

/**
 * Adapts a {@link DuckDbConnector} to the Mosaic {@link Connector} interface.
 *
 * For `'arrow'` queries the Apache Arrow table returned by the connector is
 * converted via {@link createMosaicTableFromArrowTable} into a flechette
 * `Table`, which is the shape Mosaic consumers expect (with `.toColumns()`).
 * For `'json'` queries, rows are materialized with {@link Array.from} which
 * may have performance/memory implications for very large result sets.
 */
function createDuckDbMosaicConnector(connector: DuckDbConnector): Connector {
  function query(
    request: ArrowQueryRequest,
  ): Promise<ReturnType<typeof createMosaicTableFromArrowTable>>;
  function query(request: ExecQueryRequest): Promise<void>;
  function query(request: JSONQueryRequest): Promise<Record<string, unknown>[]>;
  async function query(
    request: ConnectorQueryRequest,
  ): Promise<
    | ReturnType<typeof createMosaicTableFromArrowTable>
    | Record<string, unknown>[]
    | void
  > {
    const queryType = request.type ?? 'arrow';
    if (queryType === 'exec') {
      await connector.execute(request.sql);
      return;
    }
    if (queryType === 'json') {
      const rows = await connector.queryJson<Record<string, unknown>>(
        request.sql,
      );
      return Array.from(rows);
    }
    if (queryType === 'arrow') {
      const arrowTable = await connector.query(request.sql);
      return createMosaicTableFromArrowTable(arrowTable);
    }
    throw new Error(`Unsupported Mosaic query type "${queryType}".`);
  }

  return {query};
}
