import {
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  LayoutMosaicNode,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  BarChart3Icon,
  DatabaseIcon,
  TableIcon,
  TableRowsSplitIcon,
  TerminalIcon,
} from 'lucide-react';
import {ConsolePanel} from './panels/ConsolePanel';
import {DataSourcesPanel} from './panels/DataSourcesPanel';
import {DynamicChartPanel} from './panels/DynamicChartPanel';
import {ResultsPanel} from './panels/ResultsPanel';
import {SchemaPanel} from './panels/SchemaPanel';
import {DashboardTabs} from './panels/DashboardTabs';
import {RoomPanelTypes} from './panels/panel-types';
import {MainPanel} from './panels/MainPanel';
import {BottomTabs} from './panels/BottomTabs';

export type RoomState = RoomShellSliceState & {
  addDashboard: (tabsId?: string) => void;
  addChartToDashboard: (dashboardId: string) => void;
};

let dashboardCounter = 0;
let chartCounter = 0;

function generateDashboardId(): string {
  dashboardCounter += 1;
  return `dashboard-${dashboardCounter}`;
}

function generateChartId(): string {
  chartCounter += 1;
  return `chart-${chartCounter}`;
}

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      layout: {
        config: {
          id: 'root',
          type: 'split',
          direction: 'row',
          children: [
            {
              type: 'tabs',
              id: RoomPanelTypes.enum['left'],
              defaultSize: '30%',
              minSize: 300,
              children: [
                RoomPanelTypes.enum['data-sources'],
                RoomPanelTypes.enum['schema'],
              ],
              activeTabIndex: 0,
              collapsible: true,
              collapsedSize: 0,
              hideTabStrip: true,
            },
            {
              id: RoomPanelTypes.enum['main'],
              type: 'split',
              direction: 'column',
              children: [
                {
                  type: 'tabs',
                  id: RoomPanelTypes.enum['dashboards'],
                  children: [
                    {
                      type: 'mosaic',
                      id: 'overview',
                      draggable: true,
                      direction: 'row',
                      layout: {
                        type: 'split',
                        direction: 'row',
                        children: [
                          {
                            type: 'split',
                            direction: 'column',
                            children: ['sessions', 'conversions'],
                            splitPercentages: [40, 60],
                          },
                          {
                            type: 'split',
                            direction: 'column',
                            children: ['users', 'visits'],
                            splitPercentages: [30, 70],
                          },
                        ],
                      },
                    },
                    {
                      type: 'mosaic',
                      id: 'growth',
                      draggable: true,
                      direction: 'row',
                      layout: {
                        type: 'split',
                        direction: 'row',
                        children: ['sessions', 'conversions'],
                        splitPercentages: [60, 40],
                      },
                    },
                  ],
                  activeTabIndex: 0,
                },
                {
                  type: 'tabs',
                  id: RoomPanelTypes.enum['bottom'],
                  defaultSize: '30%',
                  children: [
                    RoomPanelTypes.enum['console'],
                    RoomPanelTypes.enum['results'],
                  ],
                  activeTabIndex: 0,
                  collapsible: true,
                  collapsed: true,
                  collapsedSize: 44,
                  minSize: 300,
                },
              ],
            },
          ],
        } satisfies LayoutConfig,
        panels: {
          'dashboards/{dashboardId}': {
            icon: BarChart3Icon,
            component: () => {
              return <div className="p-4">This is a dashboard panel</div>;
            },
          },
          'dashboards/{dashboardId}/{chartId}': {
            icon: BarChart3Icon,
            component: DynamicChartPanel,
          },
          [RoomPanelTypes.enum['dashboards']]: {
            component: DashboardTabs,
          },
          [RoomPanelTypes.enum['bottom']]: {
            component: BottomTabs,
          },
          [RoomPanelTypes.enum['data-sources']]: {
            title: 'Data Sources',
            component: DataSourcesPanel,
            icon: DatabaseIcon,
          },
          [RoomPanelTypes.enum['schema']]: {
            title: 'Schema',
            component: SchemaPanel,
            icon: TableIcon,
          },
          [RoomPanelTypes.enum['console']]: {
            title: 'Console',
            component: ConsolePanel,
            icon: TerminalIcon,
          },
          [RoomPanelTypes.enum['results']]: {
            title: 'Results',
            component: ResultsPanel,
            icon: TableRowsSplitIcon,
          },
          [RoomPanelTypes.enum['main']]: {
            component: MainPanel,
          },
        },
      },
    })(set, get, store),

    addDashboard: (tabsId = 'dashboards') => {
      const {addTab} = get().layout;

      const dashboardId = generateDashboardId();
      const chartId = generateChartId();

      const mosaicNode: LayoutMosaicNode = {
        type: 'mosaic',
        id: dashboardId,
        draggable: true,
        direction: 'row',
        layout: chartId,
      };

      addTab(tabsId, mosaicNode);
    },

    addChartToDashboard: (dashboardId: string) => {
      const {addChildToMosaic} = get().layout;

      const chartId = generateChartId();

      addChildToMosaic(dashboardId, chartId);
    },
  }),
);
