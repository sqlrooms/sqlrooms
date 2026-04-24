import {
  CellsSliceConfig,
  CellsSliceState,
  createCellsSlice,
  createDefaultCellRegistry,
} from '@sqlrooms/cells';
import {
  createNotebookSlice,
  NotebookSliceConfig,
  NotebookSliceState,
} from '@sqlrooms/notebook';
import {
  createPivotSlice,
  pivotCellRegistryEntry,
  PivotSliceConfig,
  PivotSliceState,
} from '@sqlrooms/pivot';
import {
  BaseRoomConfig,
  createPersistHelpers,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  RoomShellSliceState,
  StateCreator,
} from '@sqlrooms/room-shell';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import {NotebookPanel} from './components/NotebookPanel';

export type RoomState = RoomShellSliceState &
  NotebookSliceState &
  CellsSliceState &
  PivotSliceState & {
    apiKey: string;
    setApiKey: (apiKey: string) => void;
  };
export const RoomPanelTypes = z.enum(['main', 'left', 'data'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persist(
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
            id: 'root',
            type: 'split',
            direction: 'row',
            children: [
              {
                type: 'tabs',
                id: RoomPanelTypes.enum['left'],
                children: [RoomPanelTypes.enum['data']],
                defaultSize: '20%',
                maxSize: '50%',
                minSize: '300px',
                activeTabIndex: 0,
                collapsible: true,
                collapsed: true,
                collapsedSize: 0,
                hideTabStrip: true,
              },
              {
                type: 'panel',
                id: RoomPanelTypes.enum['main'],
                panel: RoomPanelTypes.enum['main'],
                defaultSize: '80%',
              },
            ],
          } satisfies LayoutConfig,
          panels: {
            [RoomPanelTypes.enum['main']]: {
              title: 'Notebook',
              icon: () => null,
              component: NotebookPanel,
            },
            [RoomPanelTypes.enum['data']]: {
              title: 'Data',
              icon: DatabaseIcon,
              component: DataSourcesPanel,
            },
          },
        },
      })(set, get, store),

      ...createCellsSlice({
        cellRegistry: {
          ...createDefaultCellRegistry(),
          pivot: pivotCellRegistryEntry,
        },
        supportedSheetTypes: ['notebook'],
      })(set, get, store),
      ...createNotebookSlice()(set, get, store),
      ...createPivotSlice()(set, get, store),

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
        cells: CellsSliceConfig,
        notebook: NotebookSliceConfig,
        pivot: PivotSliceConfig,
      }),
    },
  ) as StateCreator<RoomState>,
);
