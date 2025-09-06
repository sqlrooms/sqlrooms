import {
  Notebook,
  NotebookSliceConfig,
  NotebookSliceState,
  createNotebookSlice,
  createDefaultNotebookConfig,
} from '@sqlrooms/notebook';
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
import {DataSourcesPanel} from './DataSourcesPanel';
import {DatabaseIcon} from 'lucide-react';

export const RoomConfig = BaseRoomConfig.merge(NotebookSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

export type RoomState = RoomShellSliceState<RoomConfig> &
  NotebookSliceState & {
    apiKey: string;
    setApiKey: (apiKey: string) => void;
  };
export const RoomPanelTypes = z.enum(['main', 'data'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  persist(
    (set, get, store) => ({
      ...createRoomShellSlice<RoomConfig>({
        config: {
          ...createDefaultNotebookConfig(),
          // NotebookSliceConfig.parse(exampleNotebook).notebook,
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
              title: 'Notebook',
              icon: () => null,
              component: Notebook,
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

      ...createNotebookSlice<RoomConfig>({
        // getApiKey: () => get().apiKey,
        // numberOfRowsToShareWithLLM: 2,
        // defaultModel: 'gpt-4.1-mini',
      })(set, get, store),

      apiKey: '',
      setApiKey: (apiKey) => set({apiKey}),
    }),

    // Persist settings
    {
      // Local storage key
      name: 'notebook-example-app-state-storage',
      // Subset of the state to persist
      partialize: (state) => ({
        // apiKey: state.apiKey,
        config: RoomConfig.parse(state.config),
      }),
    },
  ) as StateCreator<RoomState>,
);
