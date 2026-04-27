import {
  getLayoutNodeId,
  getVisibleTabChildren,
  isLayoutDockNode,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutDockNode,
  LayoutNode,
  LayoutPanelNode,
  LayoutSplitNode,
  LayoutTabsNode,
  MAIN_VIEW,
} from '@sqlrooms/layout-config';

export type FindNodeByIdResult = {node: LayoutNode; ancestors: LayoutNode[]};

function copyPanelNodeWithInheritedSize(
  node: LayoutNode,
  inherited: Pick<
    LayoutPanelNode,
    'defaultSize' | 'minSize' | 'maxSize' | 'collapsedSize' | 'collapsible'
  >,
): LayoutNode {
  if (isLayoutNodeKey(node)) {
    return {
      type: 'panel',
      id: node,
      panel: node,
      ...inherited,
    };
  }

  return {
    ...node,
    defaultSize: node.defaultSize ?? inherited.defaultSize,
    minSize: node.minSize ?? inherited.minSize,
    maxSize: node.maxSize ?? inherited.maxSize,
    collapsedSize: node.collapsedSize ?? inherited.collapsedSize,
    collapsible: node.collapsible ?? inherited.collapsible,
  };
}

function normalizeTabsNode(node: LayoutTabsNode): LayoutNode | null {
  if (node.children.length === 0) {
    return null;
  }

  const childIds = new Set(
    node.children.map((child) => getLayoutNodeId(child)),
  );
  const hiddenChildren = (node.hiddenChildren ?? []).filter((id) =>
    childIds.has(id),
  );
  const visibleChildren = node.children.filter(
    (child) => !hiddenChildren.includes(getLayoutNodeId(child)),
  );

  return {
    ...node,
    hiddenChildren,
    activeTabIndex:
      visibleChildren.length === 0
        ? 0
        : Math.min(node.activeTabIndex, visibleChildren.length - 1),
  };
}

function normalizeSplitNode(node: LayoutSplitNode): LayoutNode | null {
  if (node.children.length === 0) {
    return null;
  }

  if (node.children.length === 1) {
    const [onlyChild] = node.children;

    if (!onlyChild) {
      return null;
    }

    return copyPanelNodeWithInheritedSize(onlyChild, {
      defaultSize: node.defaultSize,
      minSize: node.minSize,
      maxSize: node.maxSize,
      collapsedSize: node.collapsedSize,
      collapsible: node.collapsible,
    });
  }

  return node;
}

function removeNode(
  root: LayoutNode | null | undefined,
  key: string,
): LayoutNode | null {
  if (!root) {
    return null;
  }

  if (isLayoutNodeKey(root)) {
    return root === key ? null : root;
  }

  if (isLayoutPanelNode(root)) {
    return root.id === key ? null : root;
  }

  if (root.id === key) {
    return null;
  }

  if (isLayoutDockNode(root)) {
    const newRoot = removeNode(root.root, key);
    if (newRoot === null) {
      return null;
    }
    return {...root, root: newRoot};
  }

  if (isLayoutTabsNode(root)) {
    const children = root.children
      .map((child) => removeNode(child, key))
      .filter((child): child is LayoutNode => child !== null);

    return normalizeTabsNode({...root, children});
  }

  if (isLayoutSplitNode(root)) {
    const children = root.children
      .map((child) => removeNode(child, key))
      .filter((child): child is LayoutNode => child !== null);

    return normalizeSplitNode({...root, children});
  }

  return root;
}

export function createLayoutId(prefix = 'layout'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function visitLayoutLeafNodes<T = void>(
  root: LayoutNode | undefined | null,
  visitor: (node: string, ancestors: LayoutNode[]) => T,
  ancestors: LayoutNode[] = [],
): T | undefined {
  if (!root) return undefined;

  if (isLayoutNodeKey(root)) {
    return visitor(root, ancestors);
  }

  if (isLayoutPanelNode(root)) {
    return visitor(root.id, ancestors);
  }

  if (isLayoutDockNode(root)) {
    return visitLayoutLeafNodes(root.root, visitor, [...ancestors, root]);
  }

  if (isLayoutSplitNode(root)) {
    for (const child of root.children) {
      const result = visitLayoutLeafNodes(child, visitor, [...ancestors, root]);

      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  }

  if (isLayoutTabsNode(root)) {
    for (const child of getVisibleTabChildren(root)) {
      const result = visitLayoutLeafNodes(child, visitor, [...ancestors, root]);
      if (result !== undefined) return result;
    }
  }

  return undefined;
}

export function getVisibleLayoutPanels(
  root: LayoutNode | null = MAIN_VIEW,
): string[] {
  const visiblePanels: string[] = [];

  visitLayoutLeafNodes(root, (node) => {
    visiblePanels.push(node);
  });

  return visiblePanels;
}

export function findNodeById(
  root: LayoutNode | null | undefined,
  nodeId: string,
  ancestors: LayoutNode[] = [],
): FindNodeByIdResult | undefined {
  if (!root) return undefined;

  if (isLayoutNodeKey(root)) {
    return root === nodeId ? {node: root, ancestors} : undefined;
  }

  if (isLayoutPanelNode(root)) {
    return root.id === nodeId ? {node: root, ancestors} : undefined;
  }

  if (root.id === nodeId) {
    return {node: root, ancestors};
  }

  if (isLayoutDockNode(root)) {
    return findNodeById(root.root, nodeId, [...ancestors, root]);
  }

  if (isLayoutSplitNode(root) || isLayoutTabsNode(root)) {
    for (const child of root.children) {
      const result = findNodeById(child, nodeId, [...ancestors, root]);

      if (result) {
        return result;
      }
    }
  }

  return undefined;
}

export function findTabsNodeForPanel(
  root: LayoutNode,
  panelId: string,
): string | undefined {
  if (isLayoutNodeKey(root) || isLayoutPanelNode(root)) {
    return undefined;
  }

  if (isLayoutDockNode(root)) {
    return findTabsNodeForPanel(root.root, panelId);
  }

  if (isLayoutTabsNode(root)) {
    const inChildren = root.children.some(
      (child) => getLayoutNodeId(child) === panelId,
    );

    if (inChildren) {
      return root.id;
    }

    for (const child of root.children) {
      const result = findTabsNodeForPanel(child, panelId);
      if (result) {
        return result;
      }
    }

    return undefined;
  }

  if (isLayoutSplitNode(root)) {
    for (const child of root.children) {
      const result = findTabsNodeForPanel(child, panelId);
      if (result) {
        return result;
      }
    }
  }

  return undefined;
}

export function findNearestDockAncestor(
  root: LayoutNode | null | undefined,
  nodeId: string,
): LayoutDockNode | undefined {
  const found = findNodeById(root, nodeId);
  if (!found) return undefined;

  for (let index = found.ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = found.ancestors[index];
    if (ancestor && isLayoutDockNode(ancestor)) {
      return ancestor;
    }
  }
  return undefined;
}

export function isDockablePanel(
  root: LayoutNode | null | undefined,
  panelId: string,
): boolean {
  return findNearestDockAncestor(root, panelId) !== undefined;
}

export function removeLayoutNodeByKey(
  root: LayoutNode | undefined | null,
  key: string,
): {success: true; nextTree: LayoutNode | null} | {success: false} {
  if (!root || !findNodeById(root, key)) {
    return {success: false};
  }

  const nextTree = removeNode(root, key);

  return {success: true, nextTree};
}
