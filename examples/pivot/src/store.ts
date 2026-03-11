import {
  BaseRoomConfig,
  LayoutConfig,
  LayoutTypes,
  createRoomShellSlice,
  createRoomStore,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  PivotSliceConfig,
  PivotSliceState,
  createPivotSlice,
} from '@sqlrooms/pivot';
import {DatabaseIcon, TablePropertiesIcon} from 'lucide-react';
import {z} from 'zod';
import {DataPanel} from './DataPanel';
import {MainView} from './MainView';

export const RoomPanelTypes = z.enum(['data', 'main'] as const);
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
            type: LayoutTypes.enum.mosaic,
            nodes: {
              first: RoomPanelTypes.enum.data,
              second: RoomPanelTypes.enum.main,
              direction: 'row',
              splitPercentage: 24,
            },
          },
          panels: {
            [RoomPanelTypes.enum.data]: {
              title: 'Data',
              component: DataPanel,
              icon: DatabaseIcon,
              placement: 'sidebar',
            },
            [RoomPanelTypes.enum.main]: {
              title: 'Pivot',
              component: MainView,
              icon: TablePropertiesIcon,
              placement: 'main',
            },
          },
        },
      })(set, get, store),
      ...createPivotSlice({
        initialPivot: {
          source: {
            kind: 'table',
            tableName: 'tips',
          },
          config: {
            rows: ['day'],
            cols: ['sex'],
            aggregatorName: 'Sum over Sum',
            vals: ['tip', 'total_bill'],
            rendererName: 'Grouped Column Chart',
            unusedOrder: ['time', 'smoker', 'size'],
          },
        },
      })(set, get, store),
    }),
  ),
);
