import {
  Canvas,
  CanvasSliceConfig,
  CanvasSliceState,
  createCanvasSlice,
} from '@sqlrooms/canvas';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  LayoutTypes,
  RoomShellSliceState,
  StateCreator,
} from '@sqlrooms/room-shell';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import {DataSourcesPanel} from './DataSourcesPanel';

export type RoomState = RoomShellSliceState &
  CanvasSliceState & {
    apiKey: string;
    setApiKey: (apiKey: string) => void;
  };
export const RoomPanelTypes = z.enum(['main', 'data'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persist(
    (set, get, store) => ({
      ...createRoomShellSlice({
        config: {
          layout: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              splitPercentage: 20,
              first: 'data',
              second: 'main',
            },
          },
          dataSources: [
            {
              tableName: 'earthquakes',
              type: 'url',
              url: 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/earthquakes.parquet',
            },
          ],
        },
        room: {
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
          getApiKey: () => get().apiKey,
          defaultModel: 'gpt-4.1-mini',
        },
      })(set, get, store),

      apiKey: '',
      setApiKey: (apiKey) => set({apiKey}),
    }),

    // Persist settings
    {
      // Local storage key
      name: 'canvas-example-app-state-storage',
      // Subset of the state to persist
      partialize: (state) => ({
        apiKey: state.apiKey,
        room: BaseRoomConfig.parse(state.room.config),
        layout: LayoutConfig.parse(state.layout.config),
        canvas: CanvasSliceConfig.parse(state.canvas.config),
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        apiKey: persistedState.apiKey,
        room: {
          ...currentState.room,
          config: BaseRoomConfig.parse(persistedState.room),
        },
        layout: {
          ...currentState.layout,
          config: LayoutConfig.parse(persistedState.layout),
        },
        canvas: {
          ...currentState.canvas,
          config: CanvasSliceConfig.parse(persistedState.canvas),
        },
      }),
    },
  ) as StateCreator<RoomState>,
);
