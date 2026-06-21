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
  LayoutGridNode,
  LayoutNode,
  LayoutConfig,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  isLayoutDockNode,
  isLayoutGridNode,
  createDefaultLayout,
  LayoutNodeSize,
} from './LayoutConfig';

export type {PanelIdentity} from './LayoutConfig';
export type {LayoutGridItem} from './LayoutConfig';

export type {LayoutDirection} from './common';

// Tabs node helpers
export {
  getLayoutNodeId,
  getChildrenIds,
  getVisibleTabChildren,
  getHiddenTabChildren,
} from './tabs-helpers';
