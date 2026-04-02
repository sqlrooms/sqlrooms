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
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
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

export type RoomState = RoomShellSliceState & {
  addDashboard: (tabsId?: string) => void;
};

let dashboardCounter = 0;

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
                  id: 'dashboards',
                  children: [
                    {
                      type: 'mosaic',
                      id: 'overview',
                      draggable: true,
                      direction: 'row',
                      nodes: {
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
            resolveChild: ({panelId}) => ({
              title: panelId,
              icon: LayoutDashboardIcon,
              render: () => (
                <div className="h-full w-full overflow-hidden p-2">
                  <DynamicChartPanel label={panelId} />
                </div>
              ),
            }),
          },
          'data-sources': {
            title: 'Data Sources',
            component: DataSourcesPanel,
            icon: DatabaseIcon,
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
      const chartId = `${mosaicId}-chart`;

      const mosaicNode: LayoutMosaicNode = {
        type: 'mosaic',
        id: mosaicId,
        draggable: true,
        direction: 'row',
        nodes: chartId,
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
  }),
);
