import {
  createRemoveUpdate,
  MosaicDirection,
  MosaicNode,
  MosaicPath,
  updateTree,
} from 'react-mosaic-component';
import {
  MosaicLayoutNode,
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
