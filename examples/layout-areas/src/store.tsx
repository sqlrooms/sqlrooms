import {
  createRoomShellSlice,
  createRoomStore,
  getChildKey,
  getMosaicNodeKey,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutConfig,
  LayoutMosaicNode,
  LayoutNode,
  LayoutTabsNode,
  PanelRenderContext,
  RoomPanelInfo,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  BarChart3Icon,
  DatabaseIcon,
  LayoutDashboardIcon,
  TableIcon,
  TableRowsSplitIcon,
  TerminalIcon,
} from 'lucide-react';
import React from 'react';
import {ConsolePanel} from './panels/ConsolePanel';
import {DataSourcesPanel} from './panels/DataSourcesPanel';
import {DynamicChartPanel} from './panels/DynamicChartPanel';
import {ResultsPanel} from './panels/ResultsPanel';
import {SchemaPanel} from './panels/SchemaPanel';

function findAreaInState(
  root: LayoutNode | null,
  areaId: string,
): LayoutTabsNode | undefined {
  if (!root || typeof root === 'string') return undefined;
  if (isLayoutTabsNode(root) && root.id === areaId) return root;
  if (isLayoutSplitNode(root)) {
    for (const child of root.children) {
      const result = findAreaInState(child, areaId);
      if (result) return result;
    }
  }
  if (isLayoutTabsNode(root)) {
    for (const child of root.children) {
      const result = findAreaInState(child, areaId);
      if (result) return result;
    }
  }
  return undefined;
}

function addMosaicChildToArea(
  root: LayoutNode | null,
  areaId: string,
  mosaicNode: LayoutMosaicNode,
): LayoutNode | null {
  if (!root) return root;
  if (typeof root === 'string') return root;

  if (isLayoutTabsNode(root) && root.id === areaId) {
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
      const updated = addMosaicChildToArea(child, areaId, mosaicNode);
      if (updated !== child) changed = true;
      return updated;
    });
    return changed ? {...root, children: newChildren as LayoutNode[]} : root;
  }

  if (isLayoutTabsNode(root)) {
    let changed = false;
    const newChildren = root.children.map((child) => {
      const updated = addMosaicChildToArea(child, areaId, mosaicNode);
      if (updated !== child) changed = true;
      return updated;
    });
    return changed ? {...root, children: newChildren as LayoutNode[]} : root;
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

/**
 * Derive a human-readable label from a panel ID.
 * "chart-revenue" → "Revenue", "dashboard-overview" → "Overview"
 */
function labelFromId(id: string): string {
  const raw = id.replace(/^(chart|dashboard)-/, '').replace(/-\d+$/, '');
  return raw
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function isDynamicPanel(panelId: string): boolean {
  return panelId.startsWith('dashboard-') || panelId.startsWith('chart-');
}

function resolveDynamicPanelInfo(panelId: string): RoomPanelInfo | undefined {
  if (panelId.startsWith('dashboard-')) {
    return {title: labelFromId(panelId), icon: LayoutDashboardIcon};
  }
  if (panelId.startsWith('chart-')) {
    return {title: labelFromId(panelId), icon: BarChart3Icon};
  }
  return undefined;
}

function renderDynamicPanel(
  ctx: PanelRenderContext,
): React.ReactNode | undefined {
  if (!isDynamicPanel(ctx.panelId)) return undefined;
  const label = labelFromId(ctx.panelId);
  return (
    <div className="h-full w-full overflow-hidden p-2">
      <DynamicChartPanel label={label} />
    </div>
  );
}

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      layout: {
        config: {
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
        renderPanel: renderDynamicPanel,
        resolvePanelInfo: resolveDynamicPanelInfo,
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

      const mosaicNode: LayoutMosaicNode = {
        type: 'mosaic',
        id: mosaicId,
        draggable: true,
        direction: 'row',
        nodes: chartId,
      };

      const {layout} = get();
      const found = layout.config
        ? findAreaInState(layout.config, areaId)
        : undefined;
      if (found) {
        layout.setConfig(
          addMosaicChildToArea(layout.config, areaId, mosaicNode),
        );
      }
    },
  }),
);
