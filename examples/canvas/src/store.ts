import {
  Canvas,
  CanvasSliceConfig,
  CanvasSliceState,
  createCanvasSlice,
  createDefaultCanvasConfig,
} from '@sqlrooms/canvas';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  RoomShellSliceState,
  StateCreator,
} from '@sqlrooms/room-shell';
import {z} from 'zod';
import {persist} from 'zustand/middleware';

export const RoomConfig = BaseRoomConfig.merge(CanvasSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

export type RoomState = RoomShellSliceState<RoomConfig> & CanvasSliceState;

export const {roomStore} = createRoomStore<RoomConfig, RoomState>(
  persist(
    (set, get, store) => ({
      ...createRoomShellSlice<RoomConfig>({
        config: {
          layout: {
            type: LayoutTypes.enum.mosaic,
            nodes: 'main',
          },
          ...createDefaultCanvasConfig({
            nodes: [],
            edges: [],
          }),
        },
        room: {
          panels: {
            main: {
              title: 'Canvas',
              icon: () => null,
              component: Canvas,
              placement: 'main',
            },
          },
        },
      })(set, get, store),
      ...createCanvasSlice<RoomConfig>()(set, get, store),
    }),

    // Persist settings
    {
      // Local storage key
      name: 'canvas-example-app-state-storage',
      // Subset of the state to persist
      partialize: (state) => ({
        config: RoomConfig.parse(state.config),
      }),
    },
  ) as StateCreator<RoomState>,
);
