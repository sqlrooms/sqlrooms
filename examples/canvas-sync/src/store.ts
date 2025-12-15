import {
  Canvas,
  CanvasSliceConfig,
  CanvasSliceState,
  createCanvasSlice,
  createDefaultCanvasConfig,
} from '@sqlrooms/canvas';
import {
  CrdtSliceState,
  createCrdtSlice,
  createLocalStorageDocStorage,
  createWebSocketSyncConnector,
} from '@sqlrooms/crdt';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  LayoutTypes,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {DatabaseIcon} from 'lucide-react';
import {schema} from 'loro-mirror';
import {z} from 'zod';
import {DataSourcesPanel} from './DataSourcesPanel';
import {setAutoFreeze} from 'immer';

// Mirror can’t stamp $cid on frozen objects, so disable auto-freeze.
setAutoFreeze(false);

type RoomConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

// App config schema
export const AppConfig = z.object({
  apiKey: z.string().default(''),
});
export type AppConfig = z.infer<typeof AppConfig>;

export type RoomState = RoomShellSliceState &
  CanvasSliceState &
  CrdtSliceState & {
    connection: RoomConnectionStatus;
    setConnection: (status: RoomConnectionStatus) => void;
    app: {
      config: AppConfig;
      setApiKey: (apiKey: string) => void;
    };
  };
export const RoomPanelTypes = z.enum(['main', 'data'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

const canvasMirrorSchema = schema({
  canvas: schema.LoroMap({
    config: schema.LoroMap({
      nodes: schema.LoroList(
        schema.LoroMap({
          id: schema.String(),
          position: schema.LoroMap({
            x: schema.Number(),
            y: schema.Number(),
          }),
          type: schema.String(),
          data: schema.Any(),
          width: schema.Number(),
          height: schema.Number(),
        }),
        (node) => node.id,
      ),
      edges: schema.LoroList(
        schema.LoroMap({
          id: schema.String(),
          source: schema.String(),
          target: schema.String(),
        }),
        (edge) => edge.id,
      ),
    }),
  }),
});

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'canvas-sync-example-app-state-storage',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        canvas: CanvasSliceConfig,
        app: AppConfig,
      },
    },
    (set, get, store) => {
      const connector = createWebSocketSyncConnector({
        url:
          (import.meta as any).env?.VITE_SYNC_WS_URL ?? 'ws://localhost:4000',
        roomId:
          (import.meta as any).env?.VITE_SYNC_ROOM_ID ?? 'canvas-sync-room',
        sendSnapshotOnConnect: true,
        onStatus: (status) => set({connection: status}),
      });

      const crdtSlice = createCrdtSlice<
        Record<string, unknown>,
        typeof canvasMirrorSchema
      >({
        schema: canvasMirrorSchema,
        bindings: [
          {
            key: 'canvas',
            select: (state) =>
              ({
                config: {
                  nodes: (state as RoomState).canvas.config.nodes,
                  edges: (state as RoomState).canvas.config.edges,
                },
              }) as any,
            apply: (value) => {
              if (!value?.config) return;
              set((state) => ({
                ...state,
                canvas: {
                  ...state.canvas,
                  config: CanvasSliceConfig.parse({
                    ...state.canvas.config,
                    ...value.config,
                    // Keep local viewport unsynced
                    viewport: state.canvas.config.viewport,
                  }),
                },
              }));
            },
          },
        ],
        initialState: {
          canvas: {
            config: {
              nodes: [],
              edges: [],
            },
          },
        },
        // storage: createLocalStorageDocStorage('canvas-sync-example'),
        sync: connector,
      })(set, get, store);

      return {
        connection: 'idle' as RoomConnectionStatus,
        setConnection: (status) => set({connection: status}),
        ...createRoomShellSlice({
          config: {
            dataSources: [
              {
                tableName: 'earthquakes',
                type: 'url',
                url: 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/earthquakes.parquet',
              },
            ],
          },
          layout: {
            config: {
              type: LayoutTypes.enum.mosaic,
              nodes: {
                direction: 'row',
                splitPercentage: 20,
                first: 'data',
                second: 'main',
              },
            },
            panels: {
              main: {
                title: 'Canvas',
                icon: () => null,
                component: Canvas,
                placement: 'main',
              },
              data: {
                title: 'Data',
                icon: DatabaseIcon,
                component: DataSourcesPanel,
                placement: 'sidebar',
              },
            },
          },
        })(set, get, store),

        ...createCanvasSlice({
          ai: {
            getApiKey: () => get().app.config.apiKey,
            defaultModel: 'gpt-4.1-mini',
          },
        })(set, get, store),

        ...crdtSlice,

        // App slice with config
        app: {
          config: AppConfig.parse({}),
          setApiKey: (apiKey) =>
            set((state) => ({
              app: {
                ...state.app,
                config: {...state.app.config, apiKey},
              },
            })),
        },
      };
    },
  ),
);

/**
 * Starts CRDT synchronization for the canvas store and logs failures.
 */
async function startCanvasCrdtSync(): Promise<void> {
  await roomStore.getState().crdt.initialize();
}

void startCanvasCrdtSync().catch((error) => {
  console.error('Failed to start canvas CRDT sync', error);
});
