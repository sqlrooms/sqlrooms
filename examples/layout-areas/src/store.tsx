import {
  createRoomShellSlice,
  createRoomStore,
  isMosaicLayoutTabsNode,
  isMosaicLayoutSplitNode,
  LayoutConfig,
  MosaicLayoutMosaicNode,
  MosaicLayoutNode,
  MosaicLayoutTabsNode,
  RoomShellSliceState,
  getChildKey,
  getMosaicNodeKey,
} from '@sqlrooms/room-shell';
import {
  BarChart3Icon,
  DatabaseIcon,
  LayoutDashboardIcon,
  TableIcon,
  TableRowsSplitIcon,
  TerminalIcon,
} from 'lucide-react';
import {ConsolePanel} from './panels/ConsolePanel';
import {DataSourcesPanel} from './panels/DataSourcesPanel';
import {DynamicChartPanel} from './panels/DynamicChartPanel';
import {ResultsPanel} from './panels/ResultsPanel';
import {SchemaPanel} from './panels/SchemaPanel';

function findAreaInState(
  root: MosaicLayoutNode | null,
  areaId: string,
): MosaicLayoutTabsNode | undefined {
  if (!root || typeof root === 'string') return undefined;
  if (isMosaicLayoutTabsNode(root) && root.id === areaId) return root;
  if (isMosaicLayoutSplitNode(root)) {
    for (const child of root.children) {
      const result = findAreaInState(child, areaId);
      if (result) return result;
    }
  }
  if (isMosaicLayoutTabsNode(root)) {
    for (const child of root.children) {
      const result = findAreaInState(child, areaId);
      if (result) return result;
    }
  }
  return undefined;
}

function addMosaicChildToArea(
  root: MosaicLayoutNode | null,
  areaId: string,
  mosaicNode: MosaicLayoutMosaicNode,
): MosaicLayoutNode | null {
  if (!root) return root;
  if (typeof root === 'string') return root;

  if (isMosaicLayoutTabsNode(root) && root.id === areaId) {
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

  if (isMosaicLayoutSplitNode(root)) {
    let changed = false;
    const newChildren = root.children.map((child) => {
      const updated = addMosaicChildToArea(child, areaId, mosaicNode);
      if (updated !== child) changed = true;
      return updated;
    });
    return changed
      ? {...root, children: newChildren as MosaicLayoutNode[]}
      : root;
  }

  if (isMosaicLayoutTabsNode(root)) {
    let changed = false;
    const newChildren = root.children.map((child) => {
      const updated = addMosaicChildToArea(child, areaId, mosaicNode);
      if (updated !== child) changed = true;
      return updated;
    });
    return changed
      ? {...root, children: newChildren as MosaicLayoutNode[]}
      : root;
  }

  return root;
}

export type RoomState = RoomShellSliceState & {
  addDashboard: (areaId?: string) => void;
};

const CHART_LABELS = [
  'Revenue',
  'Users',
  'Conversions',
  'Sessions',
  'Bounce Rate',
  'Retention',
  'Signups',
  'Churn',
  'MRR',
  'ARPU',
];

let dashboardCounter = 0;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      layout: {
        config: {
          type: 'mosaic',
          nodes: {
            type: 'split',
            direction: 'row',
            children: [
              {
                type: 'tabs',
                id: 'left',
                children: ['data-sources', 'schema'],
                activeTabIndex: 0,
                collapsible: true,
                showTabStrip: false,
              },
              {
                type: 'split',
                direction: 'column',
                children: [
                  {
                    type: 'tabs',
                    id: 'main',
                    children: [
                      {
                        type: 'mosaic',
                        id: 'dashboard-overview',
                        draggable: true,
                        direction: 'row',
                        nodes: {
                          type: 'split',
                          direction: 'row',
                          children: ['chart-revenue', 'chart-users'],
                          splitPercentages: [50, 50],
                        },
                      },
                      {
                        type: 'mosaic',
                        id: 'dashboard-growth',
                        draggable: true,
                        direction: 'row',
                        nodes: {
                          type: 'split',
                          direction: 'row',
                          children: ['chart-conversions', 'chart-sessions'],
                          splitPercentages: [50, 50],
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
                    children: ['console', 'results'],
                    activeTabIndex: 0,
                    collapsible: true,
                    showTabStrip: true,
                    showTabStripWhenCollapsed: true,
                  },
                ],
                splitPercentages: [70, 30],
              },
            ],
            splitPercentages: [22, 78],
          },
        } satisfies LayoutConfig,
        panels: {
          'data-sources': {
            title: 'Data Sources',
            component: DataSourcesPanel,
            icon: DatabaseIcon,
            area: 'left',
          },
          schema: {
            title: 'Schema',
            component: SchemaPanel,
            icon: TableIcon,
            area: 'left',
          },
          'dashboard-overview': {
            title: 'Overview',
            component: () => <DynamicChartPanel label="Overview Dashboard" />,
            icon: LayoutDashboardIcon,
            area: 'main',
          },
          'dashboard-growth': {
            title: 'Growth',
            component: () => <DynamicChartPanel label="Growth Dashboard" />,
            icon: LayoutDashboardIcon,
            area: 'main',
          },
          'chart-revenue': {
            title: 'Revenue',
            component: () => <DynamicChartPanel label="Revenue" />,
            icon: BarChart3Icon,
          },
          'chart-users': {
            title: 'Users',
            component: () => <DynamicChartPanel label="Users" />,
            icon: BarChart3Icon,
          },
          'chart-conversions': {
            title: 'Conversions',
            component: () => <DynamicChartPanel label="Conversions" />,
            icon: BarChart3Icon,
          },
          'chart-sessions': {
            title: 'Sessions',
            component: () => <DynamicChartPanel label="Sessions" />,
            icon: BarChart3Icon,
          },
          console: {
            title: 'Console',
            component: ConsolePanel,
            icon: TerminalIcon,
            area: 'bottom',
          },
          results: {
            title: 'Results',
            component: ResultsPanel,
            icon: TableRowsSplitIcon,
            area: 'bottom',
          },
        },
      },
    })(set, get, store),

    addDashboard: (areaId = 'main') => {
      dashboardCounter += 1;
      const label = CHART_LABELS[(dashboardCounter - 1) % CHART_LABELS.length]!;
      const mosaicId = `dashboard-${label.toLowerCase().replace(/\s+/g, '-')}-${dashboardCounter}`;
      const chartId = `chart-${mosaicId}`;

      // Register a panel entry for the mosaic node (used for tab display)
      get().layout.registerPanel(mosaicId, {
        title: `${label} Dashboard`,
        icon: LayoutDashboardIcon,
        component: () => <DynamicChartPanel label={`${label} Dashboard`} />,
        area: areaId,
      });

      // Register the initial chart panel within the dashboard
      get().layout.registerPanel(chartId, {
        title: label,
        icon: BarChart3Icon,
        component: () => <DynamicChartPanel label={label} />,
      });

      // Create a mosaic node and add it directly to the area's children
      const mosaicNode: MosaicLayoutMosaicNode = {
        type: 'mosaic',
        id: mosaicId,
        draggable: true,
        direction: 'row',
        nodes: chartId,
      };

      // Add to the area using the store's produce-based mutation
      const {layout} = get();
      const found = layout.config.nodes
        ? findAreaInState(layout.config.nodes, areaId)
        : undefined;
      if (found) {
        layout.setConfig({
          ...layout.config,
          nodes: addMosaicChildToArea(layout.config.nodes, areaId, mosaicNode),
        });
      }
    },
  }),
);
