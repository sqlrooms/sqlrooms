import {
  Canvas,
  CanvasSliceConfig,
  CanvasSliceState,
  createCanvasSlice,
} from '@sqlrooms/canvas';
import {
  CrdtSliceState,
  createCrdtSlice,
  createLocalStorageDocStorage,
  createWebSocketSyncConnector,
} from '@sqlrooms/crdt';
import {createWebSocketDuckDbConnector} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  LayoutTypes,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {setAutoFreeze} from 'immer';
import {schema} from 'loro-mirror';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataSourcesPanel} from './DataSourcesPanel';

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

const SERVER_URL =
  (import.meta as any).env?.VITE_SYNC_WS_URL ?? 'ws://localhost:4000';
const ROOM_ID =
  (import.meta as any).env?.VITE_SYNC_ROOM_ID ?? 'canvas-sync-room';

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => {
    return {
      connection: 'idle' as RoomConnectionStatus,
      setConnection: (status) => set({connection: status}),

      ...createRoomShellSlice({
        connector: createWebSocketDuckDbConnector({wsUrl: SERVER_URL}),
        layout: {
          config: {
            type: LayoutTypes.enum.mosaic,
            nodes: 'main',
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

      ...createCrdtSlice<RoomState, typeof canvasMirrorSchema>({
        //storage: createLocalStorageDocStorage('canvas-sync-example'),
        sync: createWebSocketSyncConnector({
          url: SERVER_URL,
          roomId: ROOM_ID,
          sendSnapshotOnConnect: true,
          onStatus: (status) => set({connection: status}),
        }),
        schema: canvasMirrorSchema,
        bindings: [
          {
            key: 'canvas',
            select: (state) =>
              ({
                config: {
                  nodes: state.canvas.config.nodes,
                  edges: state.canvas.config.edges,
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
      })(set, get, store),
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
);
