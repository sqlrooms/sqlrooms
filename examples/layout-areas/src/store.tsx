import {
  createRoomShellSlice,
  createRoomStore,
  getChildKey,
  getMosaicNodeKey,
  isLayoutMosaicNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutConfig,
  LayoutMosaicNode,
  LayoutNode,
  LayoutTabsNode,
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

function findTabsNodeInState(
  root: LayoutNode | null,
  tabsId: string,
): LayoutTabsNode | undefined {
  if (!root || typeof root === 'string') return undefined;
  if (isLayoutTabsNode(root) && root.id === tabsId) return root;
  if (isLayoutSplitNode(root)) {
    for (const child of root.children) {
      const result = findTabsNodeInState(child, tabsId);
      if (result) return result;
    }
  }
  if (isLayoutTabsNode(root)) {
    for (const child of root.children) {
      const result = findTabsNodeInState(child, tabsId);
      if (result) return result;
    }
  }
  return undefined;
}

function addMosaicChildToTabs(
  root: LayoutNode | null,
  tabsId: string,
  mosaicNode: LayoutMosaicNode,
): LayoutNode | null {
  if (!root) return root;
  if (typeof root === 'string') return root;

  if (isLayoutTabsNode(root) && root.id === tabsId) {
    const key = getMosaicNodeKey(mosaicNode.id);
    const alreadyExists = root.children.some((c) => getChildKey(c) === key);
    if (alreadyExists) return root;
    const newChildren = [...root.children, mosaicNode];
    return {
      ...root,
      children: newChildren,
      activeTabIndex: newChildren.length - 1,
    };
  }

  if (isLayoutSplitNode(root)) {
    let changed = false;
    const newChildren = root.children.map((child) => {
      const updated = addMosaicChildToTabs(child, tabsId, mosaicNode);
      if (updated !== child) changed = true;
      return updated;
    });
    return changed ? {...root, children: newChildren as LayoutNode[]} : root;
  }

  if (isLayoutTabsNode(root)) {
    let changed = false;
    const newChildren = root.children.map((child) => {
      const updated = addMosaicChildToTabs(child, tabsId, mosaicNode);
      if (updated !== child) changed = true;
      return updated;
    });
    return changed ? {...root, children: newChildren as LayoutNode[]} : root;
  }

  return root;
}

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

    return root;
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
              id: 'left',
              defaultSize: '22%',
              minSize: 300,
              children: ['data-sources', 'schema'],
              activeTabIndex: 0,
              collapsible: true,
              collapsedSize: 0,
              showTabStrip: false,
            },
            {
              id: 'main',
              type: 'split',
              direction: 'column',
              children: [
                {
                  type: 'tabs',
                  id: 'dashboards',
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
                  showTabStrip: true,
                  creatableTabs: true,
                  closeableTabs: true,
                  searchableTabs: true,
                },
                {
                  type: 'tabs',
                  id: 'bottom',
                  defaultSize: '30%',
                  children: ['console', 'results'],
                  activeTabIndex: 0,
                  collapsible: true,
                  collapsedSize: 32,
                  showTabStrip: true,
                  showTabStripWhenCollapsed: true,
                },
              ],
            },
          ],
        } satisfies LayoutConfig,
        panels: {
          dashboards: {
            component: DashboardTabs,
          },
          'data-sources': {
            title: 'Data Sources',
            component: DataSourcesPanel,
            icon: DatabaseIcon,
          },
          'dashboards/{dashboardId}': {
            icon: BarChart3Icon,
            title: 'Dashboard 123',
            component: () => {
              return <div className="p-4">This is a dashboard panel</div>;
            },
          },
          'dashboards/{dashboardId}/{chartId}': {
            icon: BarChart3Icon,
            component: DynamicChartPanel,
          },
          schema: {
            title: 'Schema',
            component: SchemaPanel,
            icon: TableIcon,
          },
          console: {
            title: 'Console',
            component: ConsolePanel,
            icon: TerminalIcon,
          },
          results: {
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
      const chartsId = `dashboard-${dashboardCounter}-charts`;
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

      const {layout} = get();

      const found = layout.config
        ? findTabsNodeInState(layout.config, tabsId)
        : undefined;

      if (found) {
        layout.setConfig(
          addMosaicChildToTabs(layout.config, tabsId, mosaicNode),
        );
      }
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
