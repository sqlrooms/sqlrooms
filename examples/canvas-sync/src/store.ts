import {Canvas, CanvasSliceState, createCanvasSlice} from '@sqlrooms/canvas';
import {createCanvasCrdtMirror} from '@sqlrooms/canvas/crdt';
import {
  CrdtSliceState,
  createCrdtSlice,
  createIndexedDbDocStorage,
  createLocalStorageDocStorage,
  createWebSocketSyncConnector,
} from '@sqlrooms/crdt';
import {createWebSocketDuckDbConnector} from '@sqlrooms/duckdb';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {setAutoFreeze} from 'immer';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataSourcesPanel} from './DataSourcesPanel';

// Loro Mirror can’t stamp $cid on frozen objects, so disable auto-freeze.
setAutoFreeze(false);

type RoomConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

// App config schema
export const AppConfig = z.object({apiKey: z.string().default('')});
export type AppConfig = z.infer<typeof AppConfig>;

export type RoomState = RoomShellSliceState &
  CanvasSliceState &
  CrdtSliceState & {
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

      ...createCrdtSlice<RoomState>({
        storage: createIndexedDbDocStorage({key: 'sqlrooms-canvas-sync'}),
        sync: createWebSocketSyncConnector({url: SERVER_URL, roomId: ROOM_ID}),
        mirrors: {canvas: createCanvasCrdtMirror<RoomState>()},
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
