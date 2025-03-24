import {
  DEFAULT_MOSAIC_LAYOUT,
  isMosaicLayoutParent,
  MosaicLayoutNode,
} from '@sqlrooms/project';
import {
  createRemoveUpdate,
  MosaicDirection,
  MosaicNode,
  MosaicPath,
  updateTree,
} from 'react-mosaic-component';

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
  if (!root || !path) return {success: false};
  try {
    return {
      success: true,
      nextTree: updateTree<string>(root, [
        createRemoveUpdate<string>(root, path),
      ]),
    };
  } catch (err) {
    console.error(err);
    // might happen when removing main view
    return {success: false};
  }
}
