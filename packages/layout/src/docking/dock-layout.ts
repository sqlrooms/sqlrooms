import {
  getLayoutNodeId,
  isLayoutDockNode,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutNode,
  LayoutPanelNode,
  LayoutTabsNode,
} from '@sqlrooms/layout-config';
import {
  createLayoutId,
  findNearestDockAncestor,
  findNodeById,
} from '../layout-tree';

export type DockDirection = 'left' | 'right' | 'up' | 'down';
export type DockAxis = 'row' | 'column';
export const DOCK_SPLIT_ID_PREFIX = 'dock-';

type SizeProps = Pick<
  LayoutPanelNode,
  'defaultSize' | 'minSize' | 'maxSize' | 'collapsedSize' | 'collapsible'
>;

export function getDockAxis(direction: DockDirection): DockAxis {
  return direction === 'left' || direction === 'right' ? 'row' : 'column';
}

export function isDockGeneratedSplitId(id: string): boolean {
  return id.startsWith(DOCK_SPLIT_ID_PREFIX);
}

function isBefore(direction: DockDirection): boolean {
  return direction === 'left' || direction === 'up';
}

function getSizeProps(node: LayoutNode): SizeProps {
  if (isLayoutNodeKey(node)) {
    return {
      defaultSize: undefined,
      minSize: undefined,
      maxSize: undefined,
      collapsedSize: undefined,
      collapsible: undefined,
    };
  }

  return {
    defaultSize: node.defaultSize,
    minSize: node.minSize,
    maxSize: node.maxSize,
    collapsedSize: node.collapsedSize,
    collapsible: node.collapsible,
  };
}

function stripDefaultSize(node: LayoutNode): LayoutNode {
  if (isLayoutNodeKey(node)) {
    return node;
  }

  return {
    ...node,
    defaultSize: undefined,
  };
}

function withDefaultSize(
  node: LayoutNode,
  defaultSize: string | number,
): LayoutNode {
  if (isLayoutNodeKey(node)) {
    return {
      type: 'panel',
      id: node,
      defaultSize,
    };
  }

  return {
    ...node,
    defaultSize,
  };
}

function parseSizeValue(
  size: LayoutPanelNode['defaultSize'] | undefined,
): number | undefined {
  if (typeof size === 'number' && Number.isFinite(size)) {
    return size;
  }

  if (typeof size === 'string' && size.endsWith('%')) {
    const value = Number.parseFloat(size.slice(0, -1));
    return Number.isFinite(value) ? value : undefined;
  }

  return undefined;
}

function toPercent(value: number): string {
  return `${Number.parseFloat(value.toFixed(4))}%`;
}

function equalizeChildren(children: LayoutNode[]): LayoutNode[] {
  const size = 100 / children.length;
  const result = children.map((child) =>
    withDefaultSize(stripDefaultSize(child), toPercent(size)),
  );

  console.log('[Dock Layout] equalizeChildren:', {
    childCount: children.length,
    sizePerChild: toPercent(size),
    before: children.map((child) => ({
      id: getLayoutNodeId(child),
      size: getSizeProps(child).defaultSize,
    })),
    after: result.map((child) => ({
      id: getLayoutNodeId(child),
      size: getSizeProps(child).defaultSize,
    })),
  });

  return result;
}

function splitTargetShare(
  children: LayoutNode[],
  targetIndex: number,
  insertedIndex: number,
  targetShare: number,
): LayoutNode[] {
  const half = targetShare / 2;

  const result = children.map((child, index) => {
    if (index === targetIndex || index === insertedIndex) {
      return withDefaultSize(stripDefaultSize(child), toPercent(half));
    }

    return child;
  });

  console.log('[Dock Layout] splitTargetShare:', {
    targetShare: `${targetShare}%`,
    halfShare: toPercent(half),
    targetIndex,
    insertedIndex,
    before: children.map((child, i) => ({
      id: getLayoutNodeId(child),
      size: getSizeProps(child).defaultSize,
      index: i,
    })),
    after: result.map((child, i) => ({
      id: getLayoutNodeId(child),
      size: getSizeProps(child).defaultSize,
      index: i,
    })),
  });

  return result;
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

function normalizeTree(
  root: LayoutNode | null,
  options: {collapseSingleSplits?: boolean} = {},
): LayoutNode | null {
  const {collapseSingleSplits = true} = options;

  if (!root) {
    return null;
  }

  if (isLayoutNodeKey(root) || isLayoutPanelNode(root)) {
    return root;
  }

  if (isLayoutTabsNode(root)) {
    const children = root.children
      .map((child) => normalizeTree(child, options))
      .filter((child): child is LayoutNode => child !== null);

    return normalizeTabsNode({...root, children});
  }

  if (isLayoutSplitNode(root)) {
    const children = root.children
      .map((child) => normalizeTree(child, options))
      .filter((child): child is LayoutNode => child !== null);

    if (children.length === 0) {
      return null;
    }

    if (children.length === 1 && collapseSingleSplits) {
      const [onlyChild] = children;

      if (!onlyChild) {
        return null;
      }

      const inherited = getSizeProps(root);

      if (isLayoutNodeKey(onlyChild)) {
        return {
          type: 'panel',
          id: onlyChild,
          ...inherited,
        };
      }

      return {
        ...onlyChild,
        defaultSize: onlyChild.defaultSize ?? inherited.defaultSize,
        minSize: onlyChild.minSize ?? inherited.minSize,
        maxSize: onlyChild.maxSize ?? inherited.maxSize,
        collapsedSize: onlyChild.collapsedSize ?? inherited.collapsedSize,
        collapsible: onlyChild.collapsible ?? inherited.collapsible,
      };
    }

    return {...root, children};
  }

  return root;
}

function removeNode(
  root: LayoutNode | null,
  nodeId: string,
  options: {collapseSingleSplits?: boolean} = {},
): LayoutNode | null {
  if (!root) {
    return null;
  }

  if (isLayoutNodeKey(root)) {
    return root === nodeId ? null : root;
  }

  if (root.id === nodeId) {
    return null;
  }

  if (isLayoutPanelNode(root)) {
    return root.id === nodeId ? null : root;
  }

  if (isLayoutTabsNode(root)) {
    const children = root.children
      .map((child) => removeNode(child, nodeId, options))
      .filter((child): child is LayoutNode => child !== null);

    return normalizeTabsNode({...root, children});
  }

  if (isLayoutSplitNode(root)) {
    const children = root.children
      .map((child) => removeNode(child, nodeId, options))
      .filter((child): child is LayoutNode => child !== null);

    return normalizeTree({...root, children}, options);
  }

  return root;
}

function updateNode(
  root: LayoutNode | null,
  nodeId: string,
  updater: (node: LayoutNode) => LayoutNode | null,
): LayoutNode | null {
  if (!root) {
    return null;
  }

  if (isLayoutNodeKey(root)) {
    return root === nodeId ? updater(root) : root;
  }

  if (root.id === nodeId) {
    return updater(root);
  }

  if (isLayoutPanelNode(root)) {
    return root.id === nodeId ? updater(root) : root;
  }

  if (isLayoutTabsNode(root) || isLayoutSplitNode(root)) {
    const children = root.children.map((child) =>
      updateNode(child, nodeId, updater),
    );
    const next = {
      ...root,
      children: children.filter((child): child is LayoutNode => child !== null),
    };
    return normalizeTree(next);
  }

  return root;
}

function replaceTargetWithSplit(
  root: LayoutNode | null,
  targetId: string,
  sourceNode: LayoutNode,
  direction: DockDirection,
): LayoutNode | null {
  const axis = getDockAxis(direction);
  const sourceChild = withDefaultSize(stripDefaultSize(sourceNode), '50%');

  console.log('[Dock Layout] replaceTargetWithSplit (wrap mode):', {
    targetId,
    sourceId: getLayoutNodeId(sourceNode),
    direction,
    axis,
    result: 'Creating new split with 50/50 distribution',
  });

  return updateNode(root, targetId, (targetNode) => {
    const inherited = getSizeProps(targetNode);
    const targetChild = withDefaultSize(stripDefaultSize(targetNode), '50%');
    const children = isBefore(direction)
      ? [sourceChild, targetChild]
      : [targetChild, sourceChild];

    return {
      type: 'split',
      id: createLayoutId('dock'),
      direction: axis,
      children,
      ...inherited,
    };
  });
}

function replaceSingleChildParentSplit(
  root: LayoutNode | null,
  parentId: string,
  targetId: string,
  sourceNode: LayoutNode,
  direction: DockDirection,
): LayoutNode | null {
  const axis = getDockAxis(direction);
  const sourceChild = withDefaultSize(stripDefaultSize(sourceNode), '50%');

  return updateNode(root, parentId, (node) => {
    if (!isLayoutSplitNode(node) || node.children.length !== 1) {
      return node;
    }

    const [targetNode] = node.children;

    if (!targetNode || getLayoutNodeId(targetNode) !== targetId) {
      return node;
    }

    const targetChild = withDefaultSize(stripDefaultSize(targetNode), '50%');
    const children = isBefore(direction)
      ? [sourceChild, targetChild]
      : [targetChild, sourceChild];

    return {
      ...node,
      direction: axis,
      children,
    };
  });
}

function insertIntoSplit(
  root: LayoutNode | null,
  splitId: string,
  targetId: string,
  sourceNode: LayoutNode,
  direction: DockDirection,
): LayoutNode | null {
  return updateNode(root, splitId, (node) => {
    if (!isLayoutSplitNode(node)) {
      return node;
    }

    const targetIndex = node.children.findIndex(
      (child) => getLayoutNodeId(child) === targetId,
    );

    if (targetIndex < 0) {
      return node;
    }

    const insertIndex = isBefore(direction) ? targetIndex : targetIndex + 1;
    const children = [...node.children];

    children.splice(insertIndex, 0, stripDefaultSize(sourceNode));

    const targetIndexAfterInsert = isBefore(direction)
      ? targetIndex + 1
      : targetIndex;
    const targetNode = children[targetIndexAfterInsert];
    const targetSize = targetNode
      ? parseSizeValue(getSizeProps(targetNode).defaultSize)
      : undefined;

    console.log('[Dock Layout] insertIntoSplit:', {
      splitId,
      sourceId: getLayoutNodeId(sourceNode),
      targetId,
      direction,
      insertIndex,
      targetIndexAfterInsert,
      targetSize: targetSize === undefined ? 'undefined' : `${targetSize}%`,
      strategy: targetSize === undefined ? 'equalize' : 'splitTargetShare',
      childrenBeforeInsert: node.children.map((child) => ({
        id: getLayoutNodeId(child),
        size: getSizeProps(child).defaultSize,
      })),
    });

    const sizedChildren =
      targetSize === undefined
        ? equalizeChildren(children)
        : splitTargetShare(
            children,
            targetIndexAfterInsert,
            insertIndex,
            targetSize,
          );

    return {
      ...node,
      children: sizedChildren,
    };
  });
}

export function movePanel(
  root: LayoutNode | null,
  sourceId: string,
  targetId: string,
  direction: DockDirection,
): LayoutNode | null {
  console.log('[Dock Layout] movePanel START:', {
    sourceId,
    targetId,
    direction,
  });

  if (!root || sourceId === targetId) {
    return root;
  }

  const sourceFound = findNodeById(root, sourceId);
  const targetFound = findNodeById(root, targetId);

  if (!sourceFound || !targetFound) {
    return root;
  }

  // Enforce dock boundary: source and target must be in same dock
  const sourceDock = findNearestDockAncestor(root, sourceId);
  const targetDock = findNearestDockAncestor(root, targetId);

  if (sourceDock !== targetDock) {
    return root;
  }

  if (!sourceDock) {
    return root;
  }

  // Perform the move within the dock's root
  const sourceNode = sourceFound.node;

  const withoutSource = normalizeTree(
    removeNode(sourceDock.root, sourceId, {collapseSingleSplits: false}),
    {collapseSingleSplits: false},
  );

  if (!withoutSource) {
    return root;
  }

  // Find target within the modified dock root
  const nextTarget = findNodeById(withoutSource, targetId);

  if (!nextTarget) {
    return root;
  }

  const axis = getDockAxis(direction);
  const parent = nextTarget.ancestors[nextTarget.ancestors.length - 1];

  let newDockRoot: LayoutNode | null;
  let mode: string;

  if (parent && isLayoutSplitNode(parent) && parent.direction === axis) {
    mode = 'insertIntoSplit (same-axis parent)';
    newDockRoot = normalizeTree(
      insertIntoSplit(
        withoutSource,
        parent.id,
        targetId,
        sourceNode,
        direction,
      ),
    );
  } else if (
    parent &&
    isLayoutSplitNode(parent) &&
    parent.children.length === 1
  ) {
    mode = 'replaceSingleChildParentSplit';
    newDockRoot = normalizeTree(
      replaceSingleChildParentSplit(
        withoutSource,
        parent.id,
        targetId,
        sourceNode,
        direction,
      ),
    );
  } else {
    mode = 'replaceTargetWithSplit (wrap)';
    newDockRoot = normalizeTree(
      replaceTargetWithSplit(withoutSource, targetId, sourceNode, direction),
    );
  }

  console.log('[Dock Layout] movePanel MODE:', mode);

  if (!newDockRoot) {
    console.log('[Dock Layout] movePanel FAILED: newDockRoot is null');
    return root;
  }

  // Update the dock node with the new root
  const result = updateNode(root, sourceDock.id, (node) => {
    if (!isLayoutDockNode(node)) {
      return node;
    }
    return {...node, root: newDockRoot!};
  });

  console.log('[Dock Layout] movePanel COMPLETE');
  return result;
}
