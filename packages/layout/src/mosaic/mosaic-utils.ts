import {
  isLayoutMosaicNode,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutMosaicNode,
  LayoutNode,
  LayoutSplitNode,
  LayoutTabsNode,
  MAIN_VIEW,
} from '@sqlrooms/layout-config';
import {
  createRemoveUpdate,
  MosaicDirection,
  MosaicNode,
  MosaicPath,
  updateTree,
} from 'react-mosaic-component';

/** Prefix for synthetic panel keys generated for nested mosaic nodes */
export const MOSAIC_NODE_KEY_PREFIX = '__mosaic__';

/** Generate the synthetic panel key for a mosaic node */
export function getMosaicNodeKey(mosaicId: string): string {
  return `${MOSAIC_NODE_KEY_PREFIX}${mosaicId}`;
}

export function makeLayoutStack(
  direction: MosaicDirection,
  children: {node: string | MosaicNode<string> | null; weight: number}[],
): MosaicNode<string> | null {
  const childrenWithoutEmpty = children.filter(({node}) => node !== null) as {
    node: string | MosaicNode<string>;
    weight: number;
  }[];
  if (!childrenWithoutEmpty?.length) {
    return null;
  }
  if (childrenWithoutEmpty.length === 1) {
    return childrenWithoutEmpty[0]?.node ?? null;
  }

  return {
    type: 'split',
    direction,
    children: childrenWithoutEmpty.map(({node}) => node),
  };
}

export function visitLayoutLeafNodes<T = void>(
  root: LayoutNode | undefined | null,
  visitor: (node: string, path: MosaicPath) => T,
  path: MosaicPath = [],
): T | undefined {
  if (!root) return undefined;
  if (isLayoutPanelNode(root)) {
    return visitor(root.id, path);
  }
  if (isLayoutSplitNode(root)) {
    for (let i = 0; i < root.children.length; i++) {
      const rv = visitLayoutLeafNodes(root.children[i], visitor, [...path, i]);
      if (rv) return rv;
    }
    return undefined;
  } else if (isLayoutTabsNode(root)) {
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i]!;
      if (typeof child === 'string') {
        const rv = visitor(child, [...path, i]);
        if (rv) return rv;
      } else if (isLayoutMosaicNode(child)) {
        const rv = visitor(getMosaicNodeKey(child.id), [...path, i]);
        if (rv) return rv;
      } else if (isLayoutPanelNode(child)) {
        const rv = visitor(child.id, [...path, i]);
        if (rv) return rv;
      } else {
        const rv = visitLayoutLeafNodes(child, visitor, [...path, i]);
        if (rv) return rv;
      }
    }
    return undefined;
  } else if (isLayoutMosaicNode(root)) {
    return visitor(getMosaicNodeKey(root.id), path);
  } else {
    return visitor(root, path);
  }
}

export function getVisibleLayoutPanels(
  root: LayoutNode | null = MAIN_VIEW,
): string[] {
  const visiblePanels: string[] = [];
  if (root) {
    visitLayoutLeafNodes(root, (node) => {
      visiblePanels.push(node);
    });
  }
  return visiblePanels;
}

export function findLayoutNodePathByKey(
  root: LayoutNode | undefined | null,
  key: string,
): MosaicPath | undefined {
  return visitLayoutLeafNodes<MosaicPath | undefined>(root, (node, path) => {
    if (node === key) {
      return path;
    }
  });
}

export function removeLayoutNodeByKey(
  root: LayoutNode | undefined | null,
  key: string,
): {success: true; nextTree: LayoutNode} | {success: false} {
  const path = findLayoutNodePathByKey(root, key);
  if (!root || !path) return {success: false};
  try {
    return {
      success: true,
      nextTree: updateTree<string>(root as MosaicNode<string>, [
        createRemoveUpdate<string>(root as MosaicNode<string>, path),
      ]) as LayoutNode,
    };
  } catch (err) {
    console.error(err);
    return {success: false};
  }
}

// ---------------------------------------------------------------------------
// Generic node-by-id helpers
// ---------------------------------------------------------------------------

/** Any non-leaf layout node that has an `id`. */
export type IdentifiedLayoutNode =
  | LayoutTabsNode
  | (LayoutSplitNode & {id: string})
  | LayoutMosaicNode;

/** Find any node with the given `id`. Returns the node and its path in the tree. */
export function findNodeById(
  root: LayoutNode | null | undefined,
  nodeId: string,
  path: MosaicPath = [],
): {node: IdentifiedLayoutNode; path: MosaicPath} | undefined {
  if (!root || typeof root === 'string') return undefined;
  if (isLayoutPanelNode(root)) return undefined;
  if (isLayoutTabsNode(root)) {
    if (root.id === nodeId) return {node: root, path};
    for (let i = 0; i < root.children.length; i++) {
      const result = findNodeById(root.children[i], nodeId, [...path, i]);
      if (result) return result;
    }
    return undefined;
  }
  if (isLayoutSplitNode(root)) {
    if (root.id === nodeId)
      return {node: root as LayoutSplitNode & {id: string}, path};
    for (let i = 0; i < root.children.length; i++) {
      const result = findNodeById(root.children[i], nodeId, [...path, i]);
      if (result) return result;
    }
    return undefined;
  }
  if (isLayoutMosaicNode(root)) {
    if (root.id === nodeId) return {node: root, path};
    return root.nodes ? findNodeById(root.nodes, nodeId, path) : undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Tabs node helpers
// ---------------------------------------------------------------------------

/** Find a tabs node by its `id` field. Returns the node and its path in the tree. */
export function findTabsNodeById(
  root: LayoutNode | null | undefined,
  tabsId: string,
  path: MosaicPath = [],
): {node: LayoutTabsNode; path: MosaicPath} | undefined {
  const found = findNodeById(root, tabsId, path);
  if (found && isLayoutTabsNode(found.node)) {
    return {node: found.node, path: found.path};
  }
  return undefined;
}

/**
 * Find the tabs node whose children or closedChildren contain a panel with
 * the given ID. Returns the tabs node's id if found.
 */
export function findTabsNodeForPanel(
  root: LayoutNode | null | undefined,
  panelId: string,
): string | undefined {
  if (!root || typeof root === 'string') return undefined;
  if (isLayoutPanelNode(root)) return undefined;
  if (isLayoutTabsNode(root)) {
    const inChildren = root.children.some((c) => getChildKey(c) === panelId);
    const inClosed = root.closedChildren?.includes(panelId);
    if ((inChildren || inClosed) && root.id) return root.id;
    for (const child of root.children) {
      const result = findTabsNodeForPanel(child, panelId);
      if (result) return result;
    }
    return undefined;
  }
  if (isLayoutSplitNode(root)) {
    for (const child of root.children) {
      const result = findTabsNodeForPanel(child, panelId);
      if (result) return result;
    }
  }
  if (isLayoutMosaicNode(root)) {
    return root.nodes ? findTabsNodeForPanel(root.nodes, panelId) : undefined;
  }
  return undefined;
}

/** Find a split node by its `id` field. */
export function findSplitById(
  root: LayoutNode | null | undefined,
  splitId: string,
  path: MosaicPath = [],
): {node: LayoutSplitNode; path: MosaicPath} | undefined {
  const found = findNodeById(root, splitId, path);
  if (found && isLayoutSplitNode(found.node)) {
    return {node: found.node, path: found.path};
  }
  return undefined;
}

/** Get the node at a given path in the layout tree. */
export function getNodeAtPath(
  root: LayoutNode | null | undefined,
  path: MosaicPath,
): LayoutNode | undefined {
  if (!root) return undefined;
  if (path.length === 0) return root;
  if (typeof root === 'string') return undefined;
  if (isLayoutPanelNode(root)) return undefined;
  const [head, ...rest] = path;
  if (head === undefined) return root;
  if (isLayoutSplitNode(root)) {
    return getNodeAtPath(root.children[head], rest);
  }
  if (isLayoutTabsNode(root)) {
    const child = root.children[head];
    if (child === undefined) return undefined;
    return rest.length === 0 ? child : getNodeAtPath(child, rest);
  }
  return undefined;
}

/**
 * Find the parent tabs node for a tile at the given path.
 */
export function findParentArea(
  root: LayoutNode | null | undefined,
  tilePath: MosaicPath,
): {node: LayoutTabsNode; path: MosaicPath} | undefined {
  if (!root || tilePath.length === 0) return undefined;
  const parentPath = tilePath.slice(0, -1);
  const parentNode = getNodeAtPath(root, parentPath);
  if (parentNode && isLayoutTabsNode(parentNode)) {
    return {node: parentNode, path: parentPath};
  }
  return undefined;
}

/**
 * Find the parent split node for the node at the given path.
 */
export function findParentSplit(
  root: LayoutNode | null | undefined,
  childPath: MosaicPath,
): {node: LayoutSplitNode; path: MosaicPath; childIndex: number} | undefined {
  if (!root || childPath.length === 0) return undefined;
  const parentPath = childPath.slice(0, -1);
  const childIndex = childPath[childPath.length - 1]!;
  const parentNode = getNodeAtPath(root, parentPath);
  if (parentNode && isLayoutSplitNode(parentNode)) {
    return {node: parentNode, path: parentPath, childIndex};
  }
  return undefined;
}

export type ExpandDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Check whether a tile at the given path should be draggable.
 */
export function isDraggableTile(
  root: LayoutNode | null | undefined,
  tilePath: MosaicPath,
): boolean {
  if (!root) return false;
  for (let depth = tilePath.length - 1; depth >= 0; depth--) {
    const ancestorPath = tilePath.slice(0, depth);
    const ancestor = getNodeAtPath(root, ancestorPath);
    if (!ancestor || typeof ancestor === 'string') continue;
    if (
      (isLayoutSplitNode(ancestor) || isLayoutTabsNode(ancestor)) &&
      'draggable' in ancestor &&
      ancestor.draggable === true
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Determine which direction a collapsed area should expand toward.
 */
export function getExpandDirection(
  root: LayoutNode | null | undefined,
  areaPath: MosaicPath,
): ExpandDirection | undefined {
  const parent = findParentSplit(root, areaPath);
  if (!parent) return undefined;
  const {node, childIndex} = parent;
  const lastIndex = node.children.length - 1;
  if (node.direction === 'row') {
    return childIndex <= lastIndex / 2 ? 'right' : 'left';
  } else {
    return childIndex <= lastIndex / 2 ? 'down' : 'up';
  }
}

export interface CollapsedAreaInfo {
  node: LayoutTabsNode;
  path: MosaicPath;
  expandDirection: ExpandDirection;
}

/**
 * For a tabs node at `tabsPath`, find any collapsed sibling tabs nodes
 * in the same parent split that have `showTabStripWhenCollapsed`.
 */
export function findCollapsedSiblings(
  root: LayoutNode | null | undefined,
  tabsPath: MosaicPath,
): CollapsedAreaInfo[] {
  const parent = findParentSplit(root, tabsPath);
  if (!parent) return [];
  const {node: splitNode, path: splitPath} = parent;
  const result: CollapsedAreaInfo[] = [];
  for (let i = 0; i < splitNode.children.length; i++) {
    const child = splitNode.children[i];
    if (!child || typeof child === 'string') continue;
    const childPath = [...splitPath, i];
    if (pathsEqual(childPath, tabsPath)) continue;
    if (
      isLayoutTabsNode(child) &&
      child.collapsed &&
      child.showTabStripWhenCollapsed &&
      child.id
    ) {
      const dir = getExpandDirection(root, childPath);
      if (dir) {
        result.push({node: child, path: childPath, expandDirection: dir});
      }
    }
  }
  return result;
}

/** Find a mosaic node by its `id` field. */
export function findMosaicNodeById(
  root: LayoutNode | null | undefined,
  mosaicId: string,
): LayoutMosaicNode | undefined {
  const found = findNodeById(root, mosaicId);
  if (found && isLayoutMosaicNode(found.node)) {
    return found.node;
  }
  return undefined;
}

/**
 * Return a new tree with the nested mosaic node's sub-tree replaced.
 */
export function updateMosaicSubtree(
  root: LayoutNode | null,
  mosaicId: string,
  newNodes: LayoutNode | null,
): LayoutNode | null {
  if (!root) return root;
  if (typeof root === 'string') return root;
  if (isLayoutPanelNode(root)) return root;
  if (isLayoutMosaicNode(root)) {
    if (root.id === mosaicId) {
      return {...root, nodes: newNodes};
    }
    if (root.nodes) {
      const updated = updateMosaicSubtree(root.nodes, mosaicId, newNodes);
      return updated !== root.nodes ? {...root, nodes: updated} : root;
    }
    return root;
  }
  if (isLayoutSplitNode(root)) {
    let changed = false;
    const newChildren = root.children.map((child) => {
      const updated = updateMosaicSubtree(child, mosaicId, newNodes);
      if (updated !== child) changed = true;
      return updated;
    });
    return changed ? {...root, children: newChildren as LayoutNode[]} : root;
  }
  if (isLayoutTabsNode(root)) {
    let changed = false;
    const newChildren = root.children.map((child) => {
      const updated = updateMosaicSubtree(child, mosaicId, newNodes);
      if (updated !== child) changed = true;
      return updated;
    });
    return changed ? {...root, children: newChildren as LayoutNode[]} : root;
  }
  return root;
}

/**
 * Convert our extended layout tree to react-mosaic's MosaicNode<string>.
 * Only used for `type: 'mosaic'` sub-trees.
 */
export function convertToMosaicTree(
  node: LayoutNode | null,
): MosaicNode<string> | null {
  if (!node) return null;
  if (typeof node === 'string') return node;
  if (isLayoutPanelNode(node)) return node.id;
  if (isLayoutMosaicNode(node)) {
    return getMosaicNodeKey(node.id);
  }
  if (isLayoutTabsNode(node)) {
    const tabs = node.children.map((c) => {
      if (typeof c === 'string') return c;
      if (isLayoutPanelNode(c)) return c.id;
      if (isLayoutMosaicNode(c)) return getMosaicNodeKey(c.id);
      return convertToMosaicTree(c)!;
    });
    return {
      type: 'tabs' as const,
      id: node.id,
      tabs,
      activeTabIndex: node.activeTabIndex,
    } as unknown as MosaicNode<string>;
  }
  if (isLayoutSplitNode(node)) {
    return {
      ...node,
      children: node.children.map((c) => convertToMosaicTree(c)!),
    } as unknown as MosaicNode<string>;
  }
  return node as unknown as MosaicNode<string>;
}

/**
 * Convert a react-mosaic MosaicNode<string> back to our LayoutNode,
 * restoring LayoutMosaicNode instances from the original tree.
 */
export function convertFromMosaicTree(
  mosaicNode: MosaicNode<string> | null,
  originalTree: LayoutNode | null,
): LayoutNode | null {
  if (!mosaicNode) return null;
  if (typeof mosaicNode === 'string') {
    if (mosaicNode.startsWith(MOSAIC_NODE_KEY_PREFIX) && originalTree) {
      const mosaicId = mosaicNode.slice(MOSAIC_NODE_KEY_PREFIX.length);
      const original = findMosaicNodeById(originalTree, mosaicId);
      if (original) return original;
    }
    return mosaicNode;
  }
  const obj = mosaicNode as unknown as Record<string, unknown>;
  if (obj.type === 'split' && 'children' in obj) {
    const children = (obj.children as MosaicNode<string>[]).map((c) =>
      convertFromMosaicTree(c, originalTree),
    );
    return {...mosaicNode, children} as unknown as LayoutNode;
  }
  if (obj.type === 'tabs' && 'tabs' in obj) {
    const tabs = obj.tabs as MosaicNode<string>[];
    const children = tabs.map((c) => convertFromMosaicTree(c, originalTree));
    const areaId = obj.id as string | undefined;
    const originalArea =
      areaId && originalTree
        ? findTabsNodeById(originalTree, areaId)
        : undefined;
    if (originalArea) {
      return {
        ...originalArea.node,
        children,
        activeTabIndex: (obj.activeTabIndex as number) ?? 0,
      } as unknown as LayoutNode;
    }
    return {
      type: 'tabs' as const,
      children,
      activeTabIndex: (obj.activeTabIndex as number) ?? 0,
    } as unknown as LayoutNode;
  }
  return mosaicNode as unknown as LayoutNode;
}

function pathsEqual(a: MosaicPath, b: MosaicPath): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Resolve a tabs node child to its string key.
 */
export function getChildKey(child: LayoutNode): string | undefined {
  if (typeof child === 'string') return child;
  if (isLayoutPanelNode(child)) return child.id;
  if (isLayoutMosaicNode(child)) return getMosaicNodeKey(child.id);
  return undefined;
}

// ---------------------------------------------------------------------------
// Deprecated re-exports for backward compatibility
// ---------------------------------------------------------------------------

/** @deprecated Use `makeLayoutStack` */
export const makeMosaicStack = makeLayoutStack;
/** @deprecated Use `visitLayoutLeafNodes` */
export const visitMosaicLeafNodes = visitLayoutLeafNodes;
/** @deprecated Use `getVisibleLayoutPanels` */
export const getVisibleMosaicLayoutPanels = getVisibleLayoutPanels;
/** @deprecated Use `findLayoutNodePathByKey` */
export const findMosaicNodePathByKey = findLayoutNodePathByKey;
/** @deprecated Use `removeLayoutNodeByKey` */
export const removeMosaicNodeByKey = removeLayoutNodeByKey;
