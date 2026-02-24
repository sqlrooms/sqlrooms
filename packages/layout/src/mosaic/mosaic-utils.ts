import {
  MosaicLayoutDirection,
  MosaicLayoutNode,
  isMosaicLayoutParent,
  DEFAULT_MOSAIC_LAYOUT,
} from '@sqlrooms/layout-config';

type MosaicPath = Array<'first' | 'second'>;

export function makeMosaicStack(
  direction: MosaicLayoutDirection,
  children: {node: string | MosaicLayoutNode | null; weight: number}[],
): MosaicLayoutNode | null {
  const childrenWithoutEmpty = children.filter(({node}) => node !== null) as {
    node: string | MosaicLayoutNode;
    weight: number;
  }[];
  if (!childrenWithoutEmpty?.length) {
    return null;
  }
  if (childrenWithoutEmpty.length === 1) {
    return childrenWithoutEmpty[0]?.node ?? null;
  }

  let stack = childrenWithoutEmpty[0]?.node;
  if (!stack) return null;
  let accumulatedWeight = childrenWithoutEmpty[0]?.weight ?? 0;
  for (let i = 1; i < childrenWithoutEmpty.length; i++) {
    const child = childrenWithoutEmpty[i];
    if (!child) continue;
    const {node, weight} = child;
    const splitPercentage =
      (accumulatedWeight * 100) / (accumulatedWeight + weight);
    accumulatedWeight += weight;
    stack = {
      direction,
      first: stack,
      second: node,
      splitPercentage: Math.round(splitPercentage),
    };
  }
  return stack;
}

export function visitMosaicLeafNodes<T = void>(
  root: MosaicLayoutNode | undefined | null,
  visitor: (node: string, path: MosaicPath) => T, // return a truthy value to stop visiting
  path: MosaicPath = [],
): T | undefined {
  if (!root) return undefined;
  if (isMosaicLayoutParent(root)) {
    if (root.direction) {
      const rv: T | undefined =
        visitMosaicLeafNodes(root.first, visitor, [...path, 'first']) ||
        visitMosaicLeafNodes(root.second, visitor, [...path, 'second']);
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
  if (!root || !path || path.length === 0) {
    // path.length===0 means attempting to remove the root-only node (e.g. main view)
    return {success: false};
  }
  const nextTree = removeNodeAtPath(root, path);
  if (!nextTree) {
    return {success: false};
  }
  return {success: true, nextTree};
}

function removeNodeAtPath(
  root: MosaicLayoutNode,
  path: MosaicPath,
): MosaicLayoutNode | null {
  if (path.length === 0 || !isMosaicLayoutParent(root)) {
    return null;
  }

  const [head, ...tail] = path;
  if (!head) {
    return null;
  }

  if (head === 'first') {
    if (tail.length === 0) {
      return root.second;
    }
    const nextFirst = removeNodeAtPath(root.first, tail);
    if (!nextFirst) {
      return root.second;
    }
    return {...root, first: nextFirst};
  }

  if (tail.length === 0) {
    return root.first;
  }
  const nextSecond = removeNodeAtPath(root.second, tail);
  if (!nextSecond) {
    return root.first;
  }
  return {...root, second: nextSecond};
}
