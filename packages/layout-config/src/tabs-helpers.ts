import {
  LayoutNode,
  LayoutTabsNode,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
} from './LayoutConfig';

/**
 * Get the ID of a layout node.
 */
export function getLayoutNodeId(node: LayoutNode): string {
  if (typeof node === 'string') return node;
  if (isLayoutPanelNode(node)) return node.id;
  if (isLayoutSplitNode(node)) return node.id;
  if (isLayoutTabsNode(node)) return node.id;

  throw new Error('Unknown node type');
}

/**
 * Get IDs from an array of layout nodes
 */
export function getChildrenIds(children: LayoutNode[]): string[] {
  return children.map((child) => getLayoutNodeId(child));
}

/**
 * Get visible children of a tabs node (children not in hiddenChildren).
 */
export function getVisibleTabChildren(node: LayoutTabsNode): LayoutNode[] {
  const hiddenSet = new Set(node.hiddenChildren ?? []);
  return node.children.filter((child) => {
    const id = getLayoutNodeId(child);
    return !hiddenSet.has(id);
  });
}

/**
 * Get hidden children of a tabs node (children in hiddenChildren).
 */
export function getHiddenTabChildren(node: LayoutTabsNode): LayoutNode[] {
  const hiddenSet = new Set(node.hiddenChildren ?? []);
  return node.children.filter((child) => {
    const id = getLayoutNodeId(child);
    return hiddenSet.has(id);
  });
}
