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
  LayoutMosaicNode,
  LayoutNode,
  LayoutConfig,
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  isLayoutMosaicNode,
  createDefaultLayout,
  LayoutNodeSize,
} from './v2/LayoutConfig';

export {LayoutDirection} from './v2/common';

export {
  LayoutMosaicSubNode,
  LayoutMosaicPanelSubNode,
  LayoutMosaicSplitSubNode,
  isLayoutMosaicPanelSubNode,
  isLayoutMosaicSplitSubNode,
} from './v2/LayoutMosaicSubNode';

// Tabs node helpers
export {
  getLayoutNodeId,
  getChildrenIds,
  getVisibleTabChildren,
  getHiddenTabChildren,
} from './tabs-helpers';
