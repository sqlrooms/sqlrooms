import {Canvas, CanvasSliceState, createCanvasSlice} from '@sqlrooms/canvas';
import {createCanvasCrdtMirror} from '@sqlrooms/canvas/crdt';
import {
  createCellsSlice,
  createDefaultCellRegistry,
  CellsSliceState,
} from '@sqlrooms/cells';
import {
  CrdtSliceState,
  createCrdtSlice,
  // createIndexedDbDocStorage,
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

// App config schema
export const AppConfig = z.object({apiKey: z.string().default('')});
export type AppConfig = z.infer<typeof AppConfig>;

export type RoomState = RoomShellSliceState &
  CanvasSliceState &
  CellsSliceState &
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

      ...createCellsSlice({
        cellRegistry: createDefaultCellRegistry(),
      })(set, get, store),

      ...createCanvasSlice({
        ai: {
          getApiKey: () => get().app.config.apiKey,
          defaultModel: 'gpt-4.1-mini',
        },
      })(set, get, store),

      ...createCrdtSlice({
        // storage: createIndexedDbDocStorage({key: 'sqlrooms-canvas-sync'}),
        sync: createWebSocketSyncConnector({
          url: SERVER_URL,
          roomId: ROOM_ID,
          // Server already sends a snapshot on join; only send incremental updates.
          sendSnapshotOnConnect: false,
        }),
        mirrors: {canvas: createCanvasCrdtMirror()},
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
