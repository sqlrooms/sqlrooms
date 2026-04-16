import {
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  LayoutNode,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  BarChart3Icon,
  DatabaseIcon,
  TableIcon,
  TableRowsSplitIcon,
  TerminalIcon,
} from 'lucide-react';
import {BottomTabs} from './panels/BottomTabs';
import {ConsolePanel} from './panels/ConsolePanel';
import {DashboardTabs} from './panels/DashboardTabs';
import {DataSourcesPanel} from './panels/DataSourcesPanel';
import {DynamicChartPanel} from './panels/DynamicChartPanel';
import {MainPanel} from './panels/MainPanel';
import {RoomPanelTypes} from './panels/panel-types';
import {ResultsPanel} from './panels/ResultsPanel';
import {SchemaPanel} from './panels/SchemaPanel';

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

function createDashboardNode(
  dashboardId: string,
  children: LayoutNode[],
): LayoutNode {
  return {
    type: 'split',
    id: dashboardId,
    direction: 'column',
    draggable: true,
    children,
  };
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
              collapsed: true,
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
                    // createDashboardNode('overview', [
                    //   {
                    //     type: 'split',
                    //     id: 'overview-left',
                    //     direction: 'column',
                    //     draggable: true,
                    //     children: [
                    //       {
                    //         type: 'panel',
                    //         id: 'overview-sessions',
                    //         defaultSize: '40%',
                    //       },
                    //       {
                    //         type: 'panel',
                    //         id: 'overview-conversions',
                    //         defaultSize: '60%',
                    //       },
                    //     ],
                    //     defaultSize: '50%',
                    //   },
                    //   {
                    //     type: 'split',
                    //     id: 'overview-right',
                    //     direction: 'column',
                    //     draggable: true,
                    //     children: [
                    //       {
                    //         type: 'panel',
                    //         id: 'overview-users',
                    //         defaultSize: '30%',
                    //       },
                    //       {
                    //         type: 'panel',
                    //         id: 'overview-visits',
                    //         defaultSize: '70%',
                    //       },
                    //     ],
                    //     defaultSize: '50%',
                    //   },
                    // ]),
                    createDashboardNode('growth', [
                      {
                        type: 'panel',
                        id: 'foobar',
                        defaultSize: '60%',
                      },
                      {
                        type: 'panel',
                        id: 'growth-sessions-2',
                        defaultSize: '60%',
                      },
                      {
                        type: 'panel',
                        id: 'growth-conversions',
                        defaultSize: '40%',
                      },
                    ]),
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
            title: 'Dashboard',
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

      addTab(tabsId, createDashboardNode(dashboardId, [chartId]));
    },

    addChartToDashboard: (dashboardId: string) => {
      const {addChildToSplit} = get().layout;

      const chartId = generateChartId();

      addChildToSplit(dashboardId, chartId);
    },
  }),
);
