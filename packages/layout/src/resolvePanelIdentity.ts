import {
  LayoutNode,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutDockNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
} from '@sqlrooms/layout-config';

export type PanelIdentityResult = {
  panelId: string | null;
  meta?: Record<string, unknown>;
};

/**
 * Resolves the panel identity from a layout node.
 *
 * For all object nodes (panel, dock, split, tabs):
 * - If panel exists (string): returns the string as panelId
 * - If panel exists (object): returns key as panelId and meta
 * - If panel is missing: returns null (nothing to render)
 *
 * For string node keys, returns the key as panelId.
 */
export function resolvePanelIdentity(node: LayoutNode): PanelIdentityResult {
  if (isLayoutNodeKey(node)) {
    return {panelId: node, meta: undefined};
  }

  if (
    isLayoutPanelNode(node) ||
    isLayoutDockNode(node) ||
    isLayoutSplitNode(node) ||
    isLayoutTabsNode(node)
  ) {
    if (!node.panel) {
      return {panelId: null, meta: undefined};
    }

    if (typeof node.panel === 'string') {
      return {panelId: node.panel, meta: undefined};
    }

    return {panelId: node.panel.key, meta: node.panel.meta};
  }

  // Unreachable - all node types covered
  return {panelId: null, meta: undefined};
}
