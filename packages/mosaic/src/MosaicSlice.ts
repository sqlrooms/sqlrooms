import {createId} from '@paralleldrive/cuid2';
import {DuckDbSliceState, isWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {
  BaseRoomStoreState,
  createSlice,
  useBaseRoomStore,
  type SliceFunctions,
} from '@sqlrooms/room-store';
import {
  Connector,
  Coordinator,
  coordinator,
  makeClient,
  Selection,
  wasmConnector,
} from '@uwdata/mosaic-core';
import {Query} from '@uwdata/mosaic-sql';
import {produce} from 'immer';
import {z} from 'zod';

export const MosaicSliceConfig = z.object({});
export type MosaicSliceConfig = z.infer<typeof MosaicSliceConfig>;

// Client configuration options
export type MosaicClientOptions<T = unknown> = {
  /** Unique identifier for this client */
  id?: string;
  /** Selection name for cross-filtering (will create if doesn't exist) */
  selectionName?: string;
  /** The selection to subscribe to for cross-filtering */
  selection?: Selection;
  /** Query builder function that receives the current filter */
  query: (filter: unknown) => ReturnType<typeof Query.from>;
  /** Callback when query results are received */
  queryResult?: (result: T) => void;
};

// Tracked client info
export type TrackedClient<T = unknown> = {
  id: string;
  client: ReturnType<typeof makeClient>;
  createdAt: number;
  isLoading: boolean;
  data: T | null;
  selection?: Selection; // Track for change detection
  queryResultCallback?: (result: T) => void; // External callback
};

export type MosaicSliceState = {
  mosaic: SliceFunctions & {
    connection:
      | {status: 'idle' | 'loading'}
      | {status: 'ready'; connector: Connector; coordinator: Coordinator}
      | {status: 'error'; error: unknown};
    config: MosaicSliceConfig;
    /** Record of registered clients by id */
    clients: Record<string, TrackedClient<unknown>>;
    /** Named selections for cross-filtering (e.g., 'brush', 'hover') */
    selections: Record<string, Selection>;
    initialize: () => Promise<void>;
    /** Get or create a named selection for cross-filtering */
    getSelection: (
      name: string,
      type?: 'crossfilter' | 'single' | 'union',
    ) => Selection;
    /** Create a mosaic client and register it */
    createClient: <T>(options: MosaicClientOptions<T>) => string;
    /** Ensure a client exists with given options (idempotent - creates or updates as needed) */
    ensureClient: <T>(
      options: MosaicClientOptions<T> & {
        id: string;
        onQueryResult?: (result: T) => void;
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
  return {
    ...props,
  } as MosaicSliceConfig;
}

export function createMosaicSlice(props?: {
  config?: Partial<MosaicSliceConfig>;
}) {
  return createSlice<
    MosaicSliceState,
    BaseRoomStoreState & DuckDbSliceState & MosaicSliceState
  >((set, get, store) => ({
    mosaic: {
      config: createDefaultMosaicConfig(props?.config),
      connection: {
        status: 'idle',
        connector: undefined,
      },
      clients: {},
      selections: {},

      async initialize() {
        let mosaicConnector: Connector | undefined;
        set((state) =>
          produce(state, (draft) => {
            draft.mosaic.connection = {status: 'loading'};
          }),
        );
        try {
          const dbConnector = await get().db.getConnector();
          if (!isWasmDuckDbConnector(dbConnector)) {
            throw new Error('Only WasmDuckDbConnector is currently supported');
          }
          mosaicConnector = await coordinator().databaseConnector(
            wasmConnector({
              // @ts-expect-error - We install a different version of duckdb-wasm
              duckDb: dbConnector.getDb(),
              connection: dbConnector.getConnection(),
            }),
          );
        } catch (error) {
          set((state) =>
            produce(state, (draft) => {
              draft.mosaic.connection = {status: 'error', error};
            }),
          );
          throw error;
        } finally {
          set((state) =>
            produce(state, (draft) => {
              draft.mosaic.connection = {
                status: 'ready',
                connector: mosaicConnector!,
                coordinator: coordinator(),
              };
            }),
          );
        }
      },

      async destroy() {
        get().mosaic.destroyAllClients();
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

      createClient<T>(options: MosaicClientOptions<T>) {
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
          const typedData = data as T;
          set((state) =>
            produce(state, (draft) => {
              const tracked = draft.mosaic.clients[id];
              if (tracked) {
                tracked.data = typedData;
                tracked.isLoading = false;
              }
            }),
          );
          // Call external callback if provided
          options.queryResult?.(typedData);
        };

        const client = makeClient({
          coordinator: connection.coordinator,
          selection,
          query: options.query,
          queryResult: wrappedQueryResult,
        });

        set((state) =>
          produce(state, (draft) => {
            draft.mosaic.clients[id] = {
              id,
              client,
              createdAt: Date.now(),
              isLoading: true,
              data: null,
              selection,
              queryResultCallback: options.queryResult
                ? (result: unknown) => options.queryResult!(result as T)
                : undefined,
            };
          }),
        );

        return id;
      },

      ensureClient<T>(
        options: MosaicClientOptions<T> & {
          id: string;
          onQueryResult?: (result: T) => void;
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
          const typedData = data as T;
          set((state) =>
            produce(state, (draft) => {
              const tracked = draft.mosaic.clients[options.id];
              if (tracked) {
                tracked.data = typedData;
                tracked.isLoading = false;
              }
            }),
          );
          // Call external callback if provided
          options.onQueryResult?.(typedData);
          // Also call original queryResult if provided
          options.queryResult?.(typedData);
        };

        const client = makeClient({
          coordinator: connection.coordinator,
          selection,
          query: options.query,
          queryResult: wrappedQueryResult,
        });

        set((state) =>
          produce(state, (draft) => {
            draft.mosaic.clients[options.id] = {
              id: options.id,
              client,
              createdAt: Date.now(),
              isLoading: true,
              data: null,
              selection,
              queryResultCallback: options.onQueryResult as
                | ((result: unknown) => void)
                | undefined,
            };
          }),
        );
      },

      destroyClient(id: string) {
        const {connection, clients} = get().mosaic;
        const tracked = clients[id];
        if (!tracked) return;

        if (connection.status === 'ready') {
          connection.coordinator.disconnect(tracked.client);
        }

        set((state) =>
          produce(state, (draft) => {
            delete draft.mosaic.clients[id];
          }),
        );
      },

      destroyAllClients() {
        const {connection, clients} = get().mosaic;

        if (connection.status === 'ready') {
          Object.values(clients).forEach((tracked) => {
            connection.coordinator.disconnect(tracked.client);
          });
        }

        set((state) =>
          produce(state, (draft) => {
            draft.mosaic.clients = {};
          }),
        );
      },
    },
  }));
}

export type DuckDbSliceStateWithMosaic = DuckDbSliceState & MosaicSliceState;

export function useStoreWithMosaic<T>(
  selector: (state: DuckDbSliceStateWithMosaic) => T,
): T {
  return useBaseRoomStore<BaseRoomStoreState, T>((state) =>
    selector(state as unknown as DuckDbSliceStateWithMosaic),
  );
}
