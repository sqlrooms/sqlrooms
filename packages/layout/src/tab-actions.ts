import {produce} from 'immer';
import {
  isLayoutTabsNode,
  LayoutConfig,
  LayoutNode,
  LayoutTabsNode,
  getLayoutNodeId,
  getChildrenIds,
  getVisibleTabChildren,
  getHiddenTabChildren,
  isLayoutNodeKey,
} from '@sqlrooms/layout-config';
import {findNodeById} from './mosaic/mosaic-utils';

export type LayoutSliceConfig = LayoutConfig;

interface LayoutStateShape {
  layout: {
    config: LayoutSliceConfig;
    isCollapsed: (id: string) => boolean;
    setCollapsed: (id: string, collapsed: boolean) => void;
  };
}

function findTabsNode(
  config: LayoutSliceConfig,
  tabsId: string,
): {node: LayoutTabsNode; path: LayoutNode[]} | undefined {
  const found = findNodeById(config, tabsId);
  if (found && isLayoutTabsNode(found.node)) {
    return {node: found.node, path: found.ancestors};
  }
  return undefined;
}

/**
 * Get the index of a child in the visible children array.
 */
function getVisibleChildIndex(node: LayoutTabsNode, childId: string): number {
  const visibleChildren = getVisibleTabChildren(node);
  return visibleChildren.findIndex((c) => getLayoutNodeId(c) === childId);
}

/**
 * Remove a child ID from hiddenChildren array.
 */
function removeFromHidden(node: LayoutTabsNode, childId: string): void {
  if (node.hiddenChildren) {
    const idx = node.hiddenChildren.indexOf(childId);
    if (idx >= 0) {
      node.hiddenChildren.splice(idx, 1);
    }
  }
}

/**
 * Add a child ID to hiddenChildren array.
 */
function addToHidden(node: LayoutTabsNode, childId: string): void {
  if (!node.hiddenChildren) {
    node.hiddenChildren = [];
  }
  if (!node.hiddenChildren.includes(childId)) {
    node.hiddenChildren.push(childId);
  }
}

export function createTabActions<S extends LayoutStateShape>(
  set: (updater: (state: S) => S) => void,
  get: () => S,
) {
  const setActiveTab = (tabsId: string, tabId: string) => {
    set((state) =>
      produce(state, (draft) => {
        const found = findTabsNode(draft.layout.config, tabsId);
        if (!found) return;

        // Check if child exists in children array
        const childExists = found.node.children.some(
          (c) => getLayoutNodeId(c) === tabId,
        );
        if (!childExists) return;

        // Remove from hidden if present
        removeFromHidden(found.node, tabId);

        // Set activeTabIndex to the index in visible children
        const visibleIdx = getVisibleChildIndex(found.node, tabId);
        if (visibleIdx >= 0) {
          found.node.activeTabIndex = visibleIdx;
        }
      }),
    );
    if (get().layout.isCollapsed(tabsId)) {
      get().layout.setCollapsed(tabsId, false);
    }
  };

  const addTab = (tabsId: string, tabIdOrNode: string | LayoutNode) => {
    set((state) =>
      produce(state, (draft) => {
        const found = findTabsNode(draft.layout.config, tabsId);
        if (!found) return;

        // Get the ID from either string or node
        const tabId =
          typeof tabIdOrNode === 'string'
            ? tabIdOrNode
            : getLayoutNodeId(tabIdOrNode);

        // Check if child already exists
        const existingIdx = found.node.children.findIndex(
          (c) => getLayoutNodeId(c) === tabId,
        );

        if (existingIdx < 0) {
          // Child doesn't exist, add it (preserve original type)
          found.node.children.push(tabIdOrNode);
        }

        // Remove from hidden if present
        removeFromHidden(found.node, tabId);

        // Set activeTabIndex to the index in visible children
        const visibleIdx = getVisibleChildIndex(found.node, tabId);
        if (visibleIdx >= 0) {
          found.node.activeTabIndex = visibleIdx;
        }
      }),
    );
  };

  const removeTab = (tabsId: string, tabId: string) => {
    set((state) =>
      produce(state, (draft) => {
        const found = findTabsNode(draft.layout.config, tabsId);
        if (!found) return;

        // Check if child exists
        const childExists = found.node.children.some(
          (c) => getLayoutNodeId(c) === tabId,
        );
        if (!childExists) return;

        // Add to hidden (don't remove from children!)
        addToHidden(found.node, tabId);

        // Adjust activeTabIndex to stay within visible children bounds
        const visibleChildren = getVisibleTabChildren(found.node);
        if (found.node.activeTabIndex >= visibleChildren.length) {
          found.node.activeTabIndex = Math.max(0, visibleChildren.length - 1);
        }
      }),
    );
  };

  const setCollapsed = (id: string, collapsed: boolean) => {
    set((state) =>
      produce(state, (draft) => {
        const found = findNodeById(draft.layout.config, id); // Ensure size is set before collapsing

        if (!found || isLayoutNodeKey(found.node) || !found.node.collapsible) {
          return;
        }

        found.node.collapsed = collapsed;
      }),
    );
  };

  const toggleCollapsed = (id: string) => {
    const found = findNodeById(get().layout.config, id);
    if (!found || isLayoutNodeKey(found.node) || !found.node.collapsible) {
      return;
    }

    setCollapsed(id, !found.node.collapsed);
  };

  const getTabs = (tabsId: string): string[] => {
    const found = findTabsNode(get().layout.config, tabsId);
    if (!found) return [];
    // Return all children IDs (both visible and hidden)
    return getChildrenIds(found.node.children);
  };

  const getVisibleTabs = (tabsId: string): string[] => {
    const found = findTabsNode(get().layout.config, tabsId);
    if (!found) return [];
    return getChildrenIds(getVisibleTabChildren(found.node));
  };

  const getHiddenTabs = (tabsId: string): string[] => {
    const found = findTabsNode(get().layout.config, tabsId);
    if (!found) return [];
    return getChildrenIds(getHiddenTabChildren(found.node));
  };

  const getActiveTab = (tabsId: string): string | undefined => {
    const found = findTabsNode(get().layout.config, tabsId);
    if (!found) return undefined;
    // Get the active child from visible children
    const visibleChildren = getVisibleTabChildren(found.node);
    const child = visibleChildren[found.node.activeTabIndex];
    return child != null ? getLayoutNodeId(child) : undefined;
  };

  const isCollapsed = (id: string): boolean => {
    const found = findNodeById(get().layout.config, id);

    if (!found || isLayoutNodeKey(found.node) || !found.node.collapsible) {
      return false;
    }

    return found.node.collapsed === true;
  };

  return {
    setActiveTab,
    addTab,
    removeTab,
    setCollapsed,
    toggleCollapsed,
    getTabs,
    getVisibleTabs,
    getHiddenTabs,
    getActiveTab,
    isCollapsed,
  };
}
