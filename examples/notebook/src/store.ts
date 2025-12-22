import {
  createNotebookSlice,
  NotebookSliceConfigSchema,
  NotebookSliceState,
} from '@sqlrooms/notebook';
import {
  createCanvasSlice,
  CanvasSliceConfigSchema,
  CanvasSliceState,
} from '@sqlrooms/canvas';
import {
  createCellsSlice,
  createDagSlice,
  CellsSliceState,
  CellsSliceConfigSchema,
  createDefaultCellRegistry,
} from '@sqlrooms/cells';
import {
  BaseRoomConfig,
  createPersistHelpers,
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
import {NotebookPanel} from './NotebookPanel';

export type RoomState = RoomShellSliceState &
  NotebookSliceState &
  CanvasSliceState &
  CellsSliceState & {
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
              title: 'Notebook',
              icon: () => null,
              component: NotebookPanel,
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
      ...createDagSlice()(set, get),
      ...createNotebookSlice()(set, get, store),
      ...createCanvasSlice({
        ai: {
          getApiKey: () => get().apiKey,
          defaultModel: 'gpt-4.1-mini',
        },
      })(set, get, store),

      apiKey: '',
      setApiKey: (apiKey: string) => set({apiKey}),
    }),

    // Persist settings
    {
      // Local storage key
      name: 'notebook-example-app-state-storage',
      // Subset of the state to persist
      ...createPersistHelpers({
        room: BaseRoomConfig,
        layout: LayoutConfig,
        cells: CellsSliceConfigSchema,
        notebook: NotebookSliceConfigSchema,
        canvas: CanvasSliceConfigSchema,
      }),
    },
  ) as StateCreator<RoomState>,
);
