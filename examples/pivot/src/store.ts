import {
  PivotSliceConfig,
  PivotSliceState,
  createPivotSlice,
} from '@sqlrooms/pivot';
import {
  BaseRoomConfig,
  LayoutConfig,
  RoomShellSliceState,
  createRoomShellSlice,
  createRoomStore,
  persistSliceConfigs,
} from '@sqlrooms/room-shell';
import {DatabaseIcon, TablePropertiesIcon} from 'lucide-react';
import {z} from 'zod';
import {DataPanel} from './components/DataPanel';
import {MainView} from './components/MainView';
import {PivotPanel} from './components/PivotPanel';

export const RoomPanelTypes = z.enum(['left', 'data', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export type RoomState = RoomShellSliceState & PivotSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'pivot-example-app-state-storage-v2',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        pivot: PivotSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createRoomShellSlice({
        config: {
          title: 'Pivot Example',
          description: 'DuckDB-backed pivot tables with Vega-Lite charts.',
          dataSources: [
            {
              type: 'url',
              url: 'https://huggingface.co/datasets/sqlrooms/cars/resolve/main/cars.parquet',
              tableName: 'cars',
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
                id: RoomPanelTypes.enum.left,
                children: [RoomPanelTypes.enum.data],
                defaultSize: '24%',
                maxSize: '50%',
                minSize: '300px',
                activeTabIndex: 0,
                collapsible: true,
                collapsed: true,
                collapsedSize: 0,
                hideTabStrip: true,
              },
              {
                type: 'tabs',
                id: RoomPanelTypes.enum.main,
                panel: 'main',
                children: [],
                activeTabIndex: 0,
                defaultSize: '76%',
              },
            ],
          } satisfies LayoutConfig,
          panels: {
            [RoomPanelTypes.enum.data]: {
              title: 'Data',
              component: DataPanel,
              icon: DatabaseIcon,
            },
            [RoomPanelTypes.enum.main]: {
              title: 'Pivot',
              component: MainView,
              icon: TablePropertiesIcon,
            },
            pivot: (ctx) => {
              const pivotId = ctx.meta?.pivotId as string | undefined;
              const pivot = pivotId
                ? store.getState().pivot.config.pivots[pivotId]
                : undefined;
              return {
                title: pivot?.title ?? 'Pivot',
                component: PivotPanel,
                icon: TablePropertiesIcon,
              };
            },
          },
        },
      })(set, get, store),
      ...createPivotSlice({
        config: {
          tableName: 'cars',
          rows: ['Cylinders'],
          cols: ['Origin'],
          aggregatorName: 'Count',
          vals: ['MPG'],
          rendererName: 'Grouped Column Chart',
          unusedOrder: ['Displacement', 'Horsepower', 'Weight', 'Acceleration'],
        },
      })(set, get, store),
    }),
  ),
);
