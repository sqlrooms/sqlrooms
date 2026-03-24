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
  isMosaicLayoutSplitNode,
  isMosaicLayoutTabsNode,
  DEFAULT_MOSAIC_LAYOUT,
} from '@sqlrooms/layout-config';

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
    for (let i = 0; i < root.tabs.length; i++) {
      const rv = visitor(root.tabs[i]!, [...path, i]);
      if (rv) return rv;
    }
    return undefined;
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
      ]),
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
    return undefined;
  }
  if (isMosaicLayoutSplitNode(root)) {
    for (let i = 0; i < root.children.length; i++) {
      const result = findAreaById(root.children[i], areaId, [...path, i]);
      if (result) return result;
    }
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
    const key = root.tabs[head];
    if (key === undefined) return undefined;
    return rest.length === 0 ? key : undefined;
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

function pathsEqual(a: MosaicPath, b: MosaicPath): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
