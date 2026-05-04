import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  LayoutNode,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  BarChart3Icon,
  DatabaseIcon,
  TableIcon,
  TableRowsSplitIcon,
  TerminalIcon,
} from 'lucide-react';
import {BottomTabs} from './components/BottomTabs';
import {ConsolePanel} from './components/ConsolePanel';
import {DashboardTabs} from './components/DashboardTabs';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import {DynamicChartPanel} from './components/DynamicChartPanel';
import {MainPanel} from './components/MainPanel';
import {RoomPanelTypes} from './panel-types';
import {ResultsPanel} from './components/ResultsPanel';
import {SchemaPanel} from './components/SchemaPanel';
import {
  findNodeById,
  isLayoutDockNode,
  LayoutGridNode,
  isLayoutGridNode,
  isLayoutSplitNode,
  isLayoutNodeKey,
  LayoutDockNode,
} from '@sqlrooms/layout';
import {createId} from '@paralleldrive/cuid2';

export type RoomState = RoomShellSliceState & {
  addDashboard: (tabsId?: string) => void;
  addChartToDashboard: (dashboardId: string) => void;
};

function generateDashboardId(): string {
  return `dashboard-${createId()}`;
}

function generateChartId(): string {
  return `chart-${createId()}`;
}

function getDashboardTitle(meta?: Record<string, unknown>): string {
  const layoutType =
    typeof meta?.layoutType === 'string'
      ? meta.layoutType
      : meta?.dashboardId === 'growth-grid'
        ? 'grid'
        : meta?.dashboardId === 'overview'
          ? 'dock'
          : null;

  if (layoutType === 'grid') {
    return 'Grid layout';
  }

  if (layoutType === 'dock') {
    return 'Dock layout';
  }

  return `Dashboard ${meta?.dashboardId ?? ''}`;
}

function getLayoutNodeKey(node: LayoutNode): string {
  return isLayoutNodeKey(node) ? node : node.id;
}

function getGridColsForBreakpoint(
  node: LayoutGridNode,
  breakpoint: string,
): number {
  if (typeof node.cols === 'number') {
    return node.cols;
  }

  return node.cols?.[breakpoint] ?? node.cols?.lg ?? 12;
}

function createGridLayoutItem(
  node: LayoutGridNode,
  breakpoint: string,
  chartId: string,
) {
  const layout = node.layouts?.[breakpoint] ?? [];
  const cols = Math.max(1, getGridColsForBreakpoint(node, breakpoint));
  const w = Math.min(6, cols);
  const h = 2;
  const bottom = layout.reduce(
    (maxY, item) => Math.max(maxY, item.y + item.h),
    0,
  );

  for (let y = 0; y <= bottom; y += 1) {
    for (let x = 0; x <= cols - w; x += 1) {
      const overlaps = layout.some(
        (item) =>
          x < item.x + item.w &&
          x + w > item.x &&
          y < item.y + item.h &&
          y + h > item.y,
      );
      if (!overlaps) {
        return {
          i: chartId,
          x,
          y,
          w,
          h,
        };
      }
    }
  }

  return {
    i: chartId,
    x: 0,
    y: bottom,
    w,
    h,
  };
}

function createDashboardNode(
  dashboardId: string,
  children: LayoutNode[],
  direction: 'row' | 'column' = 'column',
): LayoutDockNode {
  return {
    type: 'dock',
    id: dashboardId,
    panel: {key: 'dashboard', meta: {dashboardId, layoutType: 'dock'}},
    root: {
      type: 'split',
      id: `${dashboardId}-root`,
      direction,
      children,
    },
  };
}

function createDashboardGridNode(
  dashboardId: string,
  children: LayoutNode[],
): LayoutGridNode {
  return {
    type: 'grid',
    id: dashboardId,
    panel: {key: 'dashboard', meta: {dashboardId, layoutType: 'grid'}},
    cols: 12,
    rowHeight: 220,
    margin: [12, 12],
    compactType: 'vertical',
    resizeHandles: ['e', 's', 'se'],
    children,
    layouts: {
      lg: children.map((child, index) => ({
        i: getLayoutNodeKey(child),
        x: (index * 6) % 12,
        y: Math.floor(index / 2) * 2,
        w: 6,
        h: 2,
      })),
    },
  };
}

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'layout-example-app-state-storage',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
      },
    },
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
                id: RoomPanelTypes.enum.left,
                children: [
                  RoomPanelTypes.enum.data,
                  RoomPanelTypes.enum.schema,
                ],
                defaultSize: '30%',
                maxSize: '50%',
                minSize: '300px',
                activeTabIndex: 0,
                collapsible: true,
                collapsed: true,
                collapsedSize: 0,
                hideTabStrip: true,
              },
              {
                id: RoomPanelTypes.enum.main,
                panel: RoomPanelTypes.enum.main,
                type: 'split',
                direction: 'column',
                children: [
                  {
                    type: 'tabs',
                    id: RoomPanelTypes.enum.dashboards,
                    panel: RoomPanelTypes.enum.dashboards,
                    children: [
                      createDashboardNode(
                        'dock',
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
                                defaultSize: '30%',
                                minSize: 200,
                              },
                              {
                                type: 'panel',
                                id: 'overview-visits',
                                panel: {
                                  key: 'chart',
                                  meta: {chartId: 'overview-visits'},
                                },
                                defaultSize: '70%',
                                minSize: 200,
                              },
                            ],
                            defaultSize: '50%',
                            minSize: 400,
                          },
                        ],
                        'row',
                      ),
                      createDashboardGridNode('grid', [
                        {
                          type: 'panel',
                          id: 'growth-grid-sessions',
                          panel: {
                            key: 'chart',
                            meta: {chartId: 'growth-grid-sessions'},
                          },
                        },
                        {
                          type: 'panel',
                          id: 'growth-grid-retention',
                          panel: {
                            key: 'chart',
                            meta: {chartId: 'growth-grid-retention'},
                          },
                        },
                        {
                          type: 'panel',
                          id: 'growth-grid-conversions',
                          panel: {
                            key: 'chart',
                            meta: {chartId: 'growth-grid-conversions'},
                          },
                        },
                      ]),
                    ],
                    activeTabIndex: 0,
                  },
                  {
                    type: 'tabs',
                    id: RoomPanelTypes.enum.bottom,
                    panel: RoomPanelTypes.enum.bottom,
                    defaultSize: '30%',
                    children: [
                      {
                        type: 'panel',
                        id: RoomPanelTypes.enum.console,
                        panel: RoomPanelTypes.enum.console,
                      },
                      {
                        type: 'panel',
                        id: RoomPanelTypes.enum.results,
                        panel: RoomPanelTypes.enum.results,
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
              title: getDashboardTitle(ctx.meta),
            }),
            chart: (ctx) => ({
              icon: BarChart3Icon,
              component: DynamicChartPanel,
              title: `Chart ${ctx.meta?.chartId ?? ''}`,
            }),
            [RoomPanelTypes.enum.dashboards]: {
              component: DashboardTabs,
            },
            [RoomPanelTypes.enum.bottom]: {
              component: BottomTabs,
            },
            [RoomPanelTypes.enum.data]: {
              title: 'Data',
              component: DataSourcesPanel,
              icon: DatabaseIcon,
            },
            [RoomPanelTypes.enum.schema]: {
              title: 'Schema',
              component: SchemaPanel,
              icon: TableIcon,
            },
            [RoomPanelTypes.enum.console]: {
              title: 'Console',
              component: ConsolePanel,
              icon: TerminalIcon,
            },
            [RoomPanelTypes.enum.results]: {
              title: 'Results',
              component: ResultsPanel,
              icon: TableRowsSplitIcon,
            },
            [RoomPanelTypes.enum.main]: {
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

        const dashboardResult = findNodeById(config, dashboardId);
        if (!dashboardResult) {
          return;
        }

        const newConfig = JSON.parse(JSON.stringify(config)) as LayoutConfig;
        const newDashboardResult = findNodeById(newConfig, dashboardId);
        if (!newDashboardResult) {
          return;
        }

        if (isLayoutDockNode(newDashboardResult.node)) {
          const newDockNode = newDashboardResult.node;
          if (!isLayoutSplitNode(newDockNode.root)) {
            return;
          }

          newDockNode.root.children.push({
            type: 'panel',
            id: chartId,
            panel: {key: 'chart', meta: {chartId}},
            minSize: 200,
          });

          const totalChildren = newDockNode.root.children.length;
          const equalSize = Math.floor(100 / totalChildren);

          newDockNode.root.children = newDockNode.root.children.map((child) => {
            if (isLayoutNodeKey(child)) {
              return {
                type: 'panel' as const,
                id: child,
                defaultSize: equalSize,
              };
            }

            return {
              ...child,
              defaultSize: equalSize,
            };
          });

          setConfig(newConfig);
          return;
        }

        if (isLayoutGridNode(newDashboardResult.node)) {
          const newGridNode = newDashboardResult.node;
          newGridNode.children.push({
            type: 'panel',
            id: chartId,
            panel: {key: 'chart', meta: {chartId}},
          });

          const layoutBreakpoints = Object.keys(newGridNode.layouts ?? {});
          const breakpoints =
            layoutBreakpoints.length > 0 ? layoutBreakpoints : ['lg'];
          const nextLayouts = {...(newGridNode.layouts ?? {})};

          for (const breakpoint of breakpoints) {
            nextLayouts[breakpoint] = [
              ...(nextLayouts[breakpoint] ?? []),
              createGridLayoutItem(newGridNode, breakpoint, chartId),
            ];
          }

          newGridNode.layouts = nextLayouts;
          setConfig(newConfig);
        }
      },
    }),
  ),
);
