/**
 * {@include ../README.md}
 * @packageDocumentation
 */

// New names (primary exports)
export {
  MAIN_VIEW,
  LayoutDirection,
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
} from './LayoutConfig';

// Tabs node helpers
export {
  getLayoutNodeId,
  getChildrenIds,
  getVisibleTabChildren,
  getHiddenTabChildren,
} from './tabs-helpers';

// Deprecated re-exports (old Mosaic* names)
export {
  LayoutTypes,
  DEFAULT_MOSAIC_LAYOUT,
  createDefaultMosaicLayout,
  MosaicLayoutDirection,
  MosaicLayoutSplitNode,
  MosaicLayoutTabsNode,
  MosaicLayoutMosaicNode,
  MosaicLayoutParent,
  isMosaicLayoutParent,
  isMosaicLayoutSplitNode,
  isMosaicLayoutTabsNode,
  isMosaicLayoutMosaicNode,
  MosaicLayoutNodeKey,
  MosaicLayoutNode,
  MosaicLayoutConfig,
} from './LayoutConfig';
