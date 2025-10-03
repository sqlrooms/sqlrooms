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

export const {roomStore, useRoomStore} = createRoomStore<
  BaseRoomConfig,
  RoomState
>(
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
          toolsOptions: {
            numberOfRowsToShareWithLLM: 2,
          },
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
        config: BaseRoomConfig.parse(state.config),
        canvas: CanvasSliceConfig.parse(state.canvas.config),
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        apiKey: persistedState.apiKey,
        config: BaseRoomConfig.parse(persistedState.config),
        canvas: {
          ...currentState.canvas,
          config: CanvasSliceConfig.parse(persistedState.canvas),
        },
      }),
    },
  ) as StateCreator<RoomState>,
);
