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
} from './LayoutConfig';

export {LayoutDirection} from './common';

export {
  LayoutMosaicSubNode,
  LayoutMosaicPanelSubNode,
  LayoutMosaicSplitSubNode,
  isLayoutMosaicPanelSubNode,
  isLayoutMosaicSplitSubNode,
} from './LayoutMosaicSubNode';

// Tabs node helpers
export {
  getLayoutNodeId,
  getChildrenIds,
  getVisibleTabChildren,
  getHiddenTabChildren,
} from './tabs-helpers';
