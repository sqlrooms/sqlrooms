import {Canvas, CanvasSliceState, createCanvasSlice} from '@sqlrooms/canvas';
import {createCanvasCrdtMirror} from '@sqlrooms/canvas/crdt';
import {
  CrdtSliceState,
  createCrdtSlice,
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

      ...createCrdtSlice<RoomState, any>({
        sync: createWebSocketSyncConnector({
          url: SERVER_URL,
          roomId: ROOM_ID,
          sendSnapshotOnConnect: true,
          onStatus: (status) => set({connection: status}),
        }),
        mirrors: [createCanvasCrdtMirror<RoomState>() as any],
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
