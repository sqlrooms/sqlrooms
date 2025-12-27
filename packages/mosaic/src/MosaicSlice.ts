import {createId} from '@paralleldrive/cuid2';
import {
  DuckDbSliceState,
  escapeId,
  isWasmDuckDbConnector,
} from '@sqlrooms/duckdb';
import {
  BaseRoomStoreState,
  createSlice,
  useBaseRoomStore,
} from '@sqlrooms/room-shell';
import {
  Connector,
  Coordinator,
  coordinator,
  wasmConnector,
} from '@uwdata/mosaic-core';
import {produce} from 'immer';
import {z} from 'zod';

export const MosaicSliceConfig = z.object({});
export type MosaicSliceConfig = z.infer<typeof MosaicSliceConfig>;

export type MosaicSliceState = {
  mosaic: {
    connection:
      | {status: 'idle' | 'loading'}
      | {status: 'ready'; connector: Connector; coordinator: Coordinator}
      | {status: 'error'; error: unknown};
    config: MosaicSliceConfig;
    initialize: () => Promise<void>;
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
