import {
  isLayoutMosaicNode,
  isLayoutMosaicPanelSubNode,
  isLayoutMosaicSplitSubNode,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutMosaicSplitSubNode,
  LayoutMosaicSubNode,
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

type FindNodeByIdResult = {node: LayoutNode; ancestors: LayoutNode[]};

/**
 * Find any node (including panels) with the given `id`.
 * Unlike findNodeById, this function also finds panel nodes.
 * Returns the node and an array of ancestor nodes from root to parent.
 */
export function findNodeById(
  root: LayoutNode | null | undefined,
  nodeId: string,
  ancestors: LayoutNode[] = [],
): FindNodeByIdResult | undefined {
  if (!root) return undefined;

  // Check string nodes (panel IDs)
  if (isLayoutNodeKey(root)) {
    return root === nodeId ? {node: root, ancestors} : undefined;
  }

  // Check panel and mosaic nodes
  if (isLayoutPanelNode(root) || isLayoutMosaicNode(root)) {
    return root.id === nodeId ? {node: root, ancestors} : undefined;
  }

  // Check tabs and split nodes
  if (isLayoutTabsNode(root) || isLayoutSplitNode(root)) {
    if (root.id === nodeId) {
      return {node: root, ancestors};
    }

    for (const child of root.children) {
      const result = findNodeById(child, nodeId, [...ancestors, root]);

      if (result) {
        return result;
      }
    }
    return undefined;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Tabs node helpers
// ---------------------------------------------------------------------------

/**
 * Find the tabs node whose children contain a panel with the given ID.
 * Returns the tabs node's id if found.
 * Note: children array contains ALL children (both visible and hidden).
 */
export function findTabsNodeForPanel(
  root: LayoutNode,
  panelId: string,
): string | undefined {
  if (isLayoutPanelNode(root) || isLayoutNodeKey(root)) {
    return undefined;
  }

  if (isLayoutTabsNode(root)) {
    const inChildren = root.children.some(
      (child) => getChildKey(child) === panelId,
    );

    if (inChildren && root.id) {
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
 * Return a new tree with the nested mosaic node's sub-tree replaced.
 */
export function updateMosaicSubtree(
  root: LayoutNode,
  mosaicId: string,
  newLayout: LayoutMosaicSubNode | null,
): LayoutNode {
  if (isLayoutPanelNode(root) || isLayoutNodeKey(root)) {
    return root;
  }

  if (isLayoutMosaicNode(root)) {
    if (root.id === mosaicId) {
      return {...root, layout: newLayout};
    }

    return root;
  }

  if (isLayoutSplitNode(root) || isLayoutTabsNode(root)) {
    let changed = false;
    const children = root.children.map((child) => {
      const updated = updateMosaicSubtree(child, mosaicId, newLayout);
      changed = changed || updated !== child;
      return updated;
    });

    return changed ? {...root, children} : root;
  }

  return root;
}

/**
 * Convert our extended layout tree to react-mosaic's MosaicNode<string>.
 * Only used for `type: 'mosaic'` sub-trees.
 */
export function convertToMosaicTree(
  node: LayoutMosaicSubNode,
): MosaicNode<string> | null {
  if (!node) {
    return null;
  }

  if (isLayoutMosaicPanelSubNode(node)) {
    return node;
  }

  if (isLayoutMosaicSplitSubNode(node)) {
    const children = node.children
      .map((child) => convertToMosaicTree(child))
      .filter((child): child is MosaicNode<string> => child !== null);

    // If we filtered out all children, return null
    if (children.length === 0) {
      console.warn(
        'convertToMosaicTree: split node has no valid children',
        node,
      );

      return null;
    }

    // If only one child remains, return it directly (no split needed)
    if (children.length === 1) {
      return children[0]!;
    }

    // Only include properties that react-mosaic expects (no id field)
    return {
      type: 'split',
      direction: node.direction,
      children,
      splitPercentages: node.splitPercentages,
    } satisfies MosaicNode<string>;
  }

  console.warn('Invalid mosaic sub-node:', node);

  return null;
}

/**
 * Convert a react-mosaic MosaicNode<string> back to our LayoutNode,
 * restoring LayoutMosaicNode instances from the original tree.
 */
export function convertFromMosaicTree(
  mosaicNode: MosaicNode<string>,
  originalTree: LayoutMosaicSubNode | null,
): LayoutMosaicSubNode | null {
  if (typeof mosaicNode === 'string') {
    // if (mosaicNode.startsWith(MOSAIC_NODE_KEY_PREFIX) && originalTree) {
    //   const mosaicId = mosaicNode.slice(MOSAIC_NODE_KEY_PREFIX.length);
    //   const result = findNodeById(originalTree, mosaicId);

    //   if (result && isLayoutMosaicNode(result.node)) {
    //     return result.node;
    //   }
    // }

    return mosaicNode;
  }

  if (mosaicNode.type === 'split') {
    const children = mosaicNode.children
      .map((child) => convertFromMosaicTree(child, originalTree))
      .filter((child): child is LayoutMosaicSubNode => child !== null);

    return {...mosaicNode, children} satisfies LayoutMosaicSplitSubNode;
  }

  console.warn('Invalid mosaic node:', mosaicNode);

  return null;
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
