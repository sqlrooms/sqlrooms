import {
  createRoomShellSlice,
  createRoomStore,
  isLayoutMosaicNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutConfig,
  LayoutMosaicNode,
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
import {ConsolePanel} from './panels/ConsolePanel';
import {DataSourcesPanel} from './panels/DataSourcesPanel';
import {DynamicChartPanel} from './panels/DynamicChartPanel';
import {ResultsPanel} from './panels/ResultsPanel';
import {SchemaPanel} from './panels/SchemaPanel';
import {DashboardTabs} from './panels/DashboardTabs';
import {RoomPanelTypes} from './panels/panel-types';

function addMosaicChildToMosaic(
  root: LayoutNode | null,
  tabsId: string,
  mosaicNode: string,
): LayoutNode | null {
  if (!root) return root;
  if (typeof root === 'string') return root;

  if (isLayoutSplitNode(root)) {
    let changed = false;
    const newChildren = root.children.map((child) => {
      const updated = addMosaicChildToMosaic(child, tabsId, mosaicNode);
      if (updated !== child) changed = true;
      return updated;
    });
    return changed ? {...root, children: newChildren as LayoutNode[]} : root;
  }

  if (isLayoutTabsNode(root)) {
    let changed = false;
    const newChildren = root.children.map((child) => {
      const updated = addMosaicChildToMosaic(child, tabsId, mosaicNode);
      if (updated !== child) changed = true;
      return updated;
    });
    return changed ? {...root, children: newChildren as LayoutNode[]} : root;
  }

  if (isLayoutMosaicNode(root) && root.id === tabsId) {
    if (isLayoutSplitNode(root.nodes)) {
      const alreadyExists = root.nodes.children;

      const newNodes = [...alreadyExists, mosaicNode];

      return {
        ...root,
        nodes: {
          ...root.nodes,
          children: newNodes,
        },
      };
    } else {
      return {
        ...root,
        nodes: {
          type: 'split',
          id: `${root.id}-auto-split`,
          direction: 'row',
          children: [mosaicNode],
        },
      };
    }
  }

  return root;
}

export type RoomState = RoomShellSliceState & {
  addDashboard: (tabsId?: string) => void;
  addChartToDashboard: (dashboardId: string) => void;
};

let dashboardCounter = 0;

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
                      nodes: {
                        id: 'overview-charts',
                        type: 'split',
                        direction: 'row',
                        children: ['revenue', 'users'],
                      },
                    },
                    {
                      type: 'mosaic',
                      id: 'growth',
                      draggable: true,
                      direction: 'row',
                      nodes: {
                        id: 'growth-charts',
                        type: 'split',
                        direction: 'row',
                        children: ['conversions', 'sessions'],
                      },
                    },
                  ],
                  activeTabIndex: 0,
                },
                {
                  type: 'tabs',
                  id: 'bottom',
                  defaultSize: '30%',
                  children: ['console', 'results'],
                  activeTabIndex: 0,
                  collapsible: true,
                  collapsedSize: 32,
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
        },
      },
    })(set, get, store),

    addDashboard: (tabsId = 'dashboards') => {
      dashboardCounter += 1;
      const mosaicId = `dashboard-${dashboardCounter}`;
      const chartsId = `${mosaicId}-charts`;
      const chartId = `${mosaicId}-chart`;

      const mosaicNode: LayoutMosaicNode = {
        type: 'mosaic',
        id: mosaicId,
        draggable: true,
        direction: 'row',
        nodes: {
          id: chartsId,
          type: 'split',
          direction: 'row',
          children: [chartId],
        },
      };

      get().layout.addTab(tabsId, mosaicNode);
    },

    addChartToDashboard: (dashboardId: string) => {
      dashboardCounter += 1;
      const {layout} = get();

      const mosaicId = `dashboard-${dashboardCounter}`;
      const chartId = `${mosaicId}-chart`;

      layout.setConfig(
        addMosaicChildToMosaic(layout.config, dashboardId, chartId),
      );
    },
  }),
);
