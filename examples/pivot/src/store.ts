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

export const RoomPanelTypes = z.enum(['left', 'data', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export type RoomState = RoomShellSliceState & PivotSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'pivot-example-app-state-storage',
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
              url: '/tips.csv',
              tableName: 'tips',
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
                type: 'panel',
                id: RoomPanelTypes.enum.main,
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
          },
        },
      })(set, get, store),
      ...createPivotSlice({
        config: {
          tableName: 'tips',
          rows: ['day'],
          cols: ['sex'],
          aggregatorName: 'Sum over Sum',
          vals: ['tip', 'total_bill'],
          rendererName: 'Grouped Column Chart',
          unusedOrder: ['time', 'smoker', 'size'],
        },
      })(set, get, store),
    }),
  ),
);
