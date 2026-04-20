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
import {
  findNodeById,
  isLayoutDockNode,
  isLayoutSplitNode,
  isLayoutNodeKey,
  LayoutDockNode,
} from '@sqlrooms/layout';

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
  direction: 'row' | 'column' = 'column',
): LayoutDockNode {
  return {
    type: 'dock',
    id: dashboardId,
    panel: {key: 'dashboard', meta: {dashboardId}},
    root: {
      type: 'split',
      id: `${dashboardId}-root`,
      direction,
      children,
    },
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
                {
                  type: 'panel',
                  id: 'ds',
                  panel: RoomPanelTypes.enum['data-sources'],
                },
                {
                  type: 'panel',
                  id: 'sch',
                  panel: RoomPanelTypes.enum['schema'],
                },
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
                    createDashboardNode(
                      'overview',
                      [
                        {
                          type: 'split',
                          id: 'overview-left',
                          direction: 'row',
                          children: [
                            {
                              type: 'panel',
                              id: 'overview-sessions',
                              panel: {
                                key: 'chart',
                                meta: {chartId: 'overview-sessions'},
                              },
                              defaultSize: 40,
                              minSize: 200,
                            },
                            {
                              type: 'panel',
                              id: 'overview-conversions',
                              panel: {
                                key: 'chart',
                                meta: {chartId: 'overview-conversions'},
                              },
                              defaultSize: 60,
                              minSize: 200,
                            },
                          ],
                          defaultSize: 50,
                          minSize: 400,
                        },
                        {
                          type: 'split',
                          id: 'overview-right',
                          direction: 'column',
                          children: [
                            {
                              type: 'panel',
                              id: 'overview-users',
                              panel: {
                                key: 'chart',
                                meta: {chartId: 'overview-users'},
                              },
                              defaultSize: 30,
                              minSize: 200,
                            },
                            {
                              type: 'panel',
                              id: 'overview-visits',
                              panel: {
                                key: 'chart',
                                meta: {chartId: 'overview-visits'},
                              },
                              defaultSize: 70,
                              minSize: 200,
                            },
                          ],
                          defaultSize: 50,
                          minSize: 400,
                        },
                      ],
                      'row',
                    ),
                    createDashboardNode('growth', [
                      {
                        type: 'panel',
                        id: 'foobar',
                        panel: {key: 'chart', meta: {chartId: 'foobar'}},
                        defaultSize: 60,
                      },
                      {
                        type: 'panel',
                        id: 'growth-sessions-2',
                        panel: {
                          key: 'chart',
                          meta: {chartId: 'growth-sessions-2'},
                        },
                        defaultSize: 60,
                      },
                      {
                        type: 'panel',
                        id: 'growth-conversions',
                        panel: {
                          key: 'chart',
                          meta: {chartId: 'growth-conversions'},
                        },
                        defaultSize: 40,
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
                    {
                      type: 'panel',
                      id: 'cons',
                      panel: RoomPanelTypes.enum['console'],
                    },
                    {
                      type: 'panel',
                      id: 'res',
                      panel: RoomPanelTypes.enum['results'],
                    },
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
          dashboard: (ctx) => ({
            icon: BarChart3Icon,
            title: `Dashboard ${ctx.meta?.dashboardId ?? ''}`,
          }),
          chart: (ctx) => ({
            icon: BarChart3Icon,
            component: DynamicChartPanel,
            title: `Chart ${ctx.meta?.chartId ?? ''}`,
          }),
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

      addTab(
        tabsId,
        createDashboardNode(dashboardId, [
          {
            type: 'panel',
            id: chartId,
            panel: {key: 'chart', meta: {chartId}},
          },
        ]),
      );
    },

    addChartToDashboard: (dashboardId: string) => {
      const {config, setConfig} = get().layout;
      const chartId = generateChartId();

      // Find the dock node for this dashboard
      const dockResult = findNodeById(config, dashboardId);
      if (!dockResult || !isLayoutDockNode(dockResult.node)) {
        return;
      }

      const dockNode = dockResult.node;

      // Find the root split of the dock node
      if (!isLayoutSplitNode(dockNode.root)) {
        return;
      }

      // Clone the config and add the new chart panel to the dock's root split
      const newConfig = JSON.parse(JSON.stringify(config)) as LayoutConfig;
      const newDockResult = findNodeById(newConfig, dashboardId);
      if (!newDockResult || !isLayoutDockNode(newDockResult.node)) {
        return;
      }

      const newDockNode = newDockResult.node;
      if (!isLayoutSplitNode(newDockNode.root)) {
        return;
      }

      // Add the new chart
      newDockNode.root.children.push({
        type: 'panel',
        id: chartId,
        panel: {key: 'chart', meta: {chartId}},
      });

      // Recalculate all children sizes equally
      const totalChildren = newDockNode.root.children.length;
      const equalSize = Math.floor(100 / totalChildren);

      newDockNode.root.children = newDockNode.root.children.map((child) => {
        // If child is just a string key, wrap it into a proper panel node
        if (isLayoutNodeKey(child)) {
          return {
            type: 'panel' as const,
            id: child,
            defaultSize: equalSize,
          };
        }

        // Otherwise, spread existing node and set defaultSize
        return {
          ...child,
          defaultSize: equalSize,
        };
      });

      setConfig(newConfig);
    },
  }),
);
