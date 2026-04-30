/**
 * {@include ../README.md}
 * @packageDocumentation
 */

// New names (primary exports)
export {
  MAIN_VIEW,
  LayoutNodeKey,
  LayoutPanelNode,
  LayoutSplitNode,
  LayoutTabsNode,
  LayoutDockNode,
  LayoutNode,
  LayoutConfig,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  isLayoutDockNode,
  createDefaultLayout,
  LayoutNodeSize,
} from './LayoutConfig';

export type {PanelIdentity} from './LayoutConfig';

export type {LayoutDirection} from './common';

// Tabs node helpers
export {
  getLayoutNodeId,
  getChildrenIds,
  getVisibleTabChildren,
  getHiddenTabChildren,
} from './tabs-helpers';
