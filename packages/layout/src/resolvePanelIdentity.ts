import {
  LayoutNode,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutDockNode,
} from '@sqlrooms/layout-config';

export type PanelIdentityResult = {
  panelId: string;
  meta?: Record<string, unknown>;
};

/**
 * Resolves the panel identity from a layout node.
 *
 * For panel and dock nodes with a `panel` property:
 * - String form: returns the string as panelId
 * - Object form: returns key as panelId and meta
 *
 * For nodes without a `panel` property, returns the node's `id`.
 * For string node keys, returns the key as panelId.
 */
export function resolvePanelIdentity(node: LayoutNode): PanelIdentityResult {
  if (isLayoutNodeKey(node)) {
    return {panelId: node, meta: undefined};
  }

  if (isLayoutPanelNode(node) || isLayoutDockNode(node)) {
    if (!node.panel) {
      return {panelId: node.id, meta: undefined};
    }

    if (typeof node.panel === 'string') {
      return {panelId: node.panel, meta: undefined};
    }

    return {panelId: node.panel.key, meta: node.panel.meta};
  }

  return {panelId: node.id, meta: undefined};
}
