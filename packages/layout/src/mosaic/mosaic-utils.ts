import {
  createRemoveUpdate,
  MosaicDirection,
  MosaicNode,
  MosaicPath,
  updateTree,
} from 'react-mosaic-component';
import {
  MosaicLayoutNode,
  MosaicLayoutTabsNode,
  MosaicLayoutSplitNode,
  MosaicLayoutMosaicNode,
  isMosaicLayoutSplitNode,
  isMosaicLayoutTabsNode,
  isMosaicLayoutMosaicNode,
  DEFAULT_MOSAIC_LAYOUT,
} from '@sqlrooms/layout-config';

/** Prefix for synthetic panel keys generated for nested mosaic nodes */
export const MOSAIC_NODE_KEY_PREFIX = '__mosaic__';

/** Generate the synthetic panel key for a mosaic node */
export function getMosaicNodeKey(mosaicId: string): string {
  return `${MOSAIC_NODE_KEY_PREFIX}${mosaicId}`;
}

export function makeMosaicStack(
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

  const totalWeight = childrenWithoutEmpty.reduce(
    (acc, {weight}) => acc + weight,
    0,
  );
  const splitPercentages = childrenWithoutEmpty.map(({weight}) =>
    Math.round((weight * 100) / totalWeight),
  );

  return {
    type: 'split',
    direction,
    children: childrenWithoutEmpty.map(({node}) => node),
    splitPercentages,
  };
}

export function visitMosaicLeafNodes<T = void>(
  root: MosaicLayoutNode | undefined | null,
  visitor: (node: string, path: MosaicPath) => T,
  path: MosaicPath = [],
): T | undefined {
  if (!root) return undefined;
  if (isMosaicLayoutSplitNode(root)) {
    for (let i = 0; i < root.children.length; i++) {
      const rv = visitMosaicLeafNodes(root.children[i], visitor, [...path, i]);
      if (rv) return rv;
    }
    return undefined;
  } else if (isMosaicLayoutTabsNode(root)) {
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i]!;
      if (typeof child === 'string') {
        const rv = visitor(child, [...path, i]);
        if (rv) return rv;
      } else if (isMosaicLayoutMosaicNode(child)) {
        const rv = visitor(getMosaicNodeKey(child.id), [...path, i]);
        if (rv) return rv;
      } else {
        const rv = visitMosaicLeafNodes(child, visitor, [...path, i]);
        if (rv) return rv;
      }
    }
    return undefined;
  } else if (isMosaicLayoutMosaicNode(root)) {
    return visitor(getMosaicNodeKey(root.id), path);
  } else {
    return visitor(root, path);
  }
}

export function getVisibleMosaicLayoutPanels(
  root = DEFAULT_MOSAIC_LAYOUT.nodes,
): string[] {
  const visiblePanels: string[] = [];
  if (root) {
    visitMosaicLeafNodes(root, (node) => {
      visiblePanels.push(node);
    });
  }
  return visiblePanels;
}

export function findMosaicNodePathByKey(
  root: MosaicLayoutNode | undefined | null,
  key: string,
): MosaicPath | undefined {
  return visitMosaicLeafNodes<MosaicPath | undefined>(root, (node, path) => {
    if (node === key) {
      return path;
    }
  });
}

export function removeMosaicNodeByKey(
  root: MosaicLayoutNode | undefined | null,
  key: string,
): {success: true; nextTree: MosaicLayoutNode} | {success: false} {
  const path = findMosaicNodePathByKey(root, key);
  if (!root || !path) return {success: false};
  try {
    return {
      success: true,
      nextTree: updateTree<string>(root as MosaicNode<string>, [
        createRemoveUpdate<string>(root as MosaicNode<string>, path),
      ]) as MosaicLayoutNode,
    };
  } catch (err) {
    console.error(err);
    return {success: false};
  }
}

// ---------------------------------------------------------------------------
// Area helpers
// ---------------------------------------------------------------------------

/** Find a tabs node by its `id` field. Returns the node and its path in the tree. */
export function findAreaById(
  root: MosaicLayoutNode | null | undefined,
  areaId: string,
  path: MosaicPath = [],
): {node: MosaicLayoutTabsNode; path: MosaicPath} | undefined {
  if (!root || typeof root === 'string') return undefined;
  if (isMosaicLayoutTabsNode(root)) {
    if (root.id === areaId) return {node: root, path};
    for (let i = 0; i < root.children.length; i++) {
      const result = findAreaById(root.children[i], areaId, [...path, i]);
      if (result) return result;
    }
    return undefined;
  }
  if (isMosaicLayoutSplitNode(root)) {
    for (let i = 0; i < root.children.length; i++) {
      const result = findAreaById(root.children[i], areaId, [...path, i]);
      if (result) return result;
    }
  }
  if (isMosaicLayoutMosaicNode(root)) {
    return root.nodes ? findAreaById(root.nodes, areaId, path) : undefined;
  }
  return undefined;
}

/** Find a split node by its `id` field. */
export function findSplitById(
  root: MosaicLayoutNode | null | undefined,
  splitId: string,
  path: MosaicPath = [],
): {node: MosaicLayoutSplitNode; path: MosaicPath} | undefined {
  if (!root || typeof root === 'string') return undefined;
  if (isMosaicLayoutSplitNode(root)) {
    if (root.id === splitId) return {node: root, path};
    for (let i = 0; i < root.children.length; i++) {
      const result = findSplitById(root.children[i], splitId, [...path, i]);
      if (result) return result;
    }
  }
  if (isMosaicLayoutTabsNode(root)) {
    for (let i = 0; i < root.children.length; i++) {
      const result = findSplitById(root.children[i], splitId, [...path, i]);
      if (result) return result;
    }
  }
  if (isMosaicLayoutMosaicNode(root)) {
    return root.nodes ? findSplitById(root.nodes, splitId, path) : undefined;
  }
  return undefined;
}

/** Get the node at a given path in the layout tree. */
export function getNodeAtPath(
  root: MosaicLayoutNode | null | undefined,
  path: MosaicPath,
): MosaicLayoutNode | undefined {
  if (!root) return undefined;
  if (path.length === 0) return root;
  if (typeof root === 'string') return undefined;
  const [head, ...rest] = path;
  if (head === undefined) return root;
  if (isMosaicLayoutSplitNode(root)) {
    return getNodeAtPath(root.children[head], rest);
  }
  if (isMosaicLayoutTabsNode(root)) {
    const child = root.children[head];
    if (child === undefined) return undefined;
    return rest.length === 0 ? child : getNodeAtPath(child, rest);
  }
  return undefined;
}

/**
 * Find the parent tabs node for a tile at the given path.
 * Walks up the tree to find the nearest MosaicLayoutTabsNode ancestor.
 */
export function findParentArea(
  root: MosaicLayoutNode | null | undefined,
  tilePath: MosaicPath,
): {node: MosaicLayoutTabsNode; path: MosaicPath} | undefined {
  if (!root || tilePath.length === 0) return undefined;
  const parentPath = tilePath.slice(0, -1);
  const parentNode = getNodeAtPath(root, parentPath);
  if (parentNode && isMosaicLayoutTabsNode(parentNode)) {
    return {node: parentNode, path: parentPath};
  }
  return undefined;
}

/**
 * Find the parent split node for the node at the given path.
 */
export function findParentSplit(
  root: MosaicLayoutNode | null | undefined,
  childPath: MosaicPath,
):
  | {node: MosaicLayoutSplitNode; path: MosaicPath; childIndex: number}
  | undefined {
  if (!root || childPath.length === 0) return undefined;
  const parentPath = childPath.slice(0, -1);
  const childIndex = childPath[childPath.length - 1]!;
  const parentNode = getNodeAtPath(root, parentPath);
  if (parentNode && isMosaicLayoutSplitNode(parentNode)) {
    return {node: parentNode, path: parentPath, childIndex};
  }
  return undefined;
}

export type ExpandDirection = 'left' | 'right' | 'up' | 'down';

/**
 * Check whether a tile at the given path should be draggable.
 * Walks up ancestors looking for a split or tabs node with `draggable: true`.
 */
export function isDraggableTile(
  root: MosaicLayoutNode | null | undefined,
  tilePath: MosaicPath,
): boolean {
  if (!root) return false;
  for (let depth = tilePath.length - 1; depth >= 0; depth--) {
    const ancestorPath = tilePath.slice(0, depth);
    const ancestor = getNodeAtPath(root, ancestorPath);
    if (!ancestor || typeof ancestor === 'string') continue;
    if (
      (isMosaicLayoutSplitNode(ancestor) || isMosaicLayoutTabsNode(ancestor)) &&
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
 * Based on the parent split direction and position of the child within it.
 */
export function getExpandDirection(
  root: MosaicLayoutNode | null | undefined,
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
  node: MosaicLayoutTabsNode;
  path: MosaicPath;
  expandDirection: ExpandDirection;
}

/**
 * For a tabs node at `tabsPath`, find any collapsed sibling tabs nodes
 * in the same parent split that have `showTabStripWhenCollapsed`.
 * Returns info about where the strip should appear relative to this tile.
 */
export function findCollapsedSiblings(
  root: MosaicLayoutNode | null | undefined,
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
      isMosaicLayoutTabsNode(child) &&
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
  root: MosaicLayoutNode | null | undefined,
  mosaicId: string,
): MosaicLayoutMosaicNode | undefined {
  if (!root || typeof root === 'string') return undefined;
  if (isMosaicLayoutMosaicNode(root)) {
    if (root.id === mosaicId) return root;
    return root.nodes ? findMosaicNodeById(root.nodes, mosaicId) : undefined;
  }
  if (isMosaicLayoutSplitNode(root)) {
    for (const child of root.children) {
      const result = findMosaicNodeById(child, mosaicId);
      if (result) return result;
    }
  }
  if (isMosaicLayoutTabsNode(root)) {
    for (const child of root.children) {
      const result = findMosaicNodeById(child, mosaicId);
      if (result) return result;
    }
  }
  return undefined;
}

/**
 * Return a new tree with the nested mosaic node's sub-tree replaced.
 * Used when a nested MosaicLayout's onChange fires.
 */
export function updateMosaicSubtree(
  root: MosaicLayoutNode | null,
  mosaicId: string,
  newNodes: MosaicLayoutNode | null,
): MosaicLayoutNode | null {
  if (!root) return root;
  if (typeof root === 'string') return root;
  if (isMosaicLayoutMosaicNode(root)) {
    if (root.id === mosaicId) {
      return {...root, nodes: newNodes};
    }
    if (root.nodes) {
      const updated = updateMosaicSubtree(root.nodes, mosaicId, newNodes);
      return updated !== root.nodes ? {...root, nodes: updated} : root;
    }
    return root;
  }
  if (isMosaicLayoutSplitNode(root)) {
    let changed = false;
    const newChildren = root.children.map((child) => {
      const updated = updateMosaicSubtree(child, mosaicId, newNodes);
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
      const updated = updateMosaicSubtree(child, mosaicId, newNodes);
      if (updated !== child) changed = true;
      return updated;
    });
    return changed
      ? {...root, children: newChildren as MosaicLayoutNode[]}
      : root;
  }
  return root;
}

/**
 * Convert our extended layout tree to react-mosaic's MosaicNode<string>.
 * Replaces MosaicLayoutMosaicNode instances with their synthetic panel key.
 */
export function convertToMosaicTree(
  node: MosaicLayoutNode | null,
): MosaicNode<string> | null {
  if (!node) return null;
  if (typeof node === 'string') return node;
  if (isMosaicLayoutMosaicNode(node)) {
    return getMosaicNodeKey(node.id);
  }
  if (isMosaicLayoutTabsNode(node)) {
    const tabs = node.children.map((c) => {
      if (typeof c === 'string') return c;
      if (isMosaicLayoutMosaicNode(c)) return getMosaicNodeKey(c.id);
      return convertToMosaicTree(c)!;
    });
    return {
      type: 'tabs' as const,
      id: node.id,
      tabs,
      activeTabIndex: node.activeTabIndex,
    } as unknown as MosaicNode<string>;
  }
  if (isMosaicLayoutSplitNode(node)) {
    return {
      ...node,
      children: node.children.map((c) => convertToMosaicTree(c)!),
    } as unknown as MosaicNode<string>;
  }
  return node as unknown as MosaicNode<string>;
}

/**
 * Convert a react-mosaic MosaicNode<string> back to our MosaicLayoutNode,
 * restoring MosaicLayoutMosaicNode instances from the original tree.
 */
export function convertFromMosaicTree(
  mosaicNode: MosaicNode<string> | null,
  originalTree: MosaicLayoutNode | null,
): MosaicLayoutNode | null {
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
    return {...mosaicNode, children} as unknown as MosaicLayoutNode;
  }
  if (obj.type === 'tabs' && 'tabs' in obj) {
    const tabs = obj.tabs as MosaicNode<string>[];
    const children = tabs.map((c) => convertFromMosaicTree(c, originalTree));
    const areaId = obj.id as string | undefined;
    const originalArea =
      areaId && originalTree ? findAreaById(originalTree, areaId) : undefined;
    if (originalArea) {
      return {
        ...originalArea.node,
        children,
        activeTabIndex: (obj.activeTabIndex as number) ?? 0,
      } as unknown as MosaicLayoutNode;
    }
    return {
      type: 'tabs' as const,
      children,
      activeTabIndex: (obj.activeTabIndex as number) ?? 0,
    } as unknown as MosaicLayoutNode;
  }
  return mosaicNode as unknown as MosaicLayoutNode;
}

function pathsEqual(a: MosaicPath, b: MosaicPath): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Resolve a tabs node child to its string key.
 * For string children returns the string itself.
 * For mosaic nodes returns the synthetic `__mosaic__<id>` key.
 * For other structured nodes, returns undefined (they don't have a single key).
 */
export function getChildKey(child: MosaicLayoutNode): string | undefined {
  if (typeof child === 'string') return child;
  if (isMosaicLayoutMosaicNode(child)) return getMosaicNodeKey(child.id);
  return undefined;
}
