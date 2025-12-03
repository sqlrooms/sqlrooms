import {
  Canvas,
  CanvasSliceConfig,
  CanvasSliceState,
  createCanvasSlice,
} from '@sqlrooms/canvas';
import {
  BaseRoomConfig,
  createPersistHelpers,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  LayoutTypes,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {persist, PersistOptions} from 'zustand/middleware';
import {DataSourcesPanel} from './DataSourcesPanel';

export type RoomState = RoomShellSliceState &
  CanvasSliceState & {
    apiKey: string;
    setApiKey: (apiKey: string) => void;
  };
export const RoomPanelTypes = z.enum(['main', 'data'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persist<RoomState>(
    (set, get, store) => ({
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
          getApiKey: () => get().apiKey,
          defaultModel: 'gpt-4.1-mini',
        },
      })(set, get, store),

      apiKey: '',
      setApiKey: (apiKey) => set({apiKey}),
    }),

    // Persist settings with custom partialize/merge for apiKey
    {
      name: 'canvas-example-app-state-storage',
      ...(() => {
        const {partialize, merge} = createPersistHelpers({
          room: BaseRoomConfig,
          layout: LayoutConfig,
          canvas: CanvasSliceConfig,
        });
        return {
          partialize: (state: RoomState) => ({
            apiKey: state.apiKey,
            ...partialize(state),
          }),
          merge: (persistedState: any, currentState: RoomState) => ({
            ...merge(persistedState, currentState),
            apiKey: persistedState.apiKey,
          }),
        } as Pick<PersistOptions<RoomState>, 'partialize' | 'merge'>;
      })(),
    },
  ),
);
