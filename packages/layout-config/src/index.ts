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
  LayoutNode,
  LayoutConfig,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  createDefaultLayout,
  LayoutNodeSize,
} from './LayoutConfig';

export {LayoutDirection} from './common';

// Tabs node helpers
export {
  getLayoutNodeId,
  getChildrenIds,
  getVisibleTabChildren,
  getHiddenTabChildren,
} from './tabs-helpers';
