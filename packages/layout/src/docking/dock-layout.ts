import {
  getLayoutNodeId,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutNode,
  LayoutPanelNode,
  LayoutSplitNode,
  LayoutTabsNode,
} from '@sqlrooms/layout-config';
import {createLayoutId, findNodeById} from '../layout-tree';

export type DockDirection = 'left' | 'right' | 'up' | 'down';
export type DockAxis = 'row' | 'column';

type SizeProps = Pick<
  LayoutPanelNode,
  'defaultSize' | 'minSize' | 'maxSize' | 'collapsedSize' | 'collapsible'
>;

export function getDockAxis(direction: DockDirection): DockAxis {
  return direction === 'left' || direction === 'right' ? 'row' : 'column';
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

function stripSizeProps(node: LayoutNode): LayoutNode {
  if (isLayoutNodeKey(node)) {
    return node;
  }

  return {
    ...node,
    defaultSize: undefined,
    minSize: undefined,
    maxSize: undefined,
    collapsedSize: undefined,
    collapsible: undefined,
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
  return children.map((child) =>
    withDefaultSize(stripSizeProps(child), toPercent(size)),
  );
}

function splitTargetShare(
  children: LayoutNode[],
  targetIndex: number,
  insertedIndex: number,
  targetShare: number,
): LayoutNode[] {
  const half = targetShare / 2;

  return children.map((child, index) => {
    if (index === targetIndex || index === insertedIndex) {
      return withDefaultSize(stripSizeProps(child), toPercent(half));
    }

    return child;
  });
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

    if (
      children.length === 1 &&
      collapseSingleSplits &&
      root.draggable !== true
    ) {
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
  const sourceChild = withDefaultSize(stripSizeProps(sourceNode), '50%');

  return updateNode(root, targetId, (targetNode) => {
    const inherited = getSizeProps(targetNode);
    const targetChild = withDefaultSize(stripSizeProps(targetNode), '50%');
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
  const sourceChild = withDefaultSize(stripSizeProps(sourceNode), '50%');

  return updateNode(root, parentId, (node) => {
    if (!isLayoutSplitNode(node) || node.children.length !== 1) {
      return node;
    }

    const [targetNode] = node.children;

    if (!targetNode || getLayoutNodeId(targetNode) !== targetId) {
      return node;
    }

    const targetChild = withDefaultSize(stripSizeProps(targetNode), '50%');
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

    children.splice(insertIndex, 0, stripSizeProps(sourceNode));

    const targetIndexAfterInsert = isBefore(direction)
      ? targetIndex + 1
      : targetIndex;
    const targetNode = children[targetIndexAfterInsert];
    const targetSize = targetNode
      ? parseSizeValue(getSizeProps(targetNode).defaultSize)
      : undefined;

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
  if (!root || sourceId === targetId) {
    return root;
  }

  const sourceFound = findNodeById(root, sourceId);
  const targetFound = findNodeById(root, targetId);

  if (!sourceFound || !targetFound) {
    return root;
  }

  const sourceNode = sourceFound.node;

  const withoutSource = normalizeTree(
    removeNode(root, sourceId, {collapseSingleSplits: false}),
    {collapseSingleSplits: false},
  );

  if (!withoutSource) {
    return root;
  }

  const nextTarget = findNodeById(withoutSource, targetId);

  if (!nextTarget) {
    return root;
  }

  const axis = getDockAxis(direction);
  const parent = nextTarget.ancestors[nextTarget.ancestors.length - 1];

  if (parent && isLayoutSplitNode(parent) && parent.direction === axis) {
    return normalizeTree(
      insertIntoSplit(
        withoutSource,
        parent.id,
        targetId,
        sourceNode,
        direction,
      ),
    );
  }

  if (parent && isLayoutSplitNode(parent) && parent.children.length === 1) {
    return normalizeTree(
      replaceSingleChildParentSplit(
        withoutSource,
        parent.id,
        targetId,
        sourceNode,
        direction,
      ),
    );
  }

  return normalizeTree(
    replaceTargetWithSplit(withoutSource, targetId, sourceNode, direction),
  );
}
