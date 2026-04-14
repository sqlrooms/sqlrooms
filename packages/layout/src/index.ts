/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  createLayoutSlice,
  useStoreWithLayout,
  createDefaultLayoutConfig,
  LayoutSliceConfig,
} from './LayoutSlice';
export type {LayoutSliceState, CreateLayoutSliceProps} from './LayoutSlice';
export type {
  RoomPanelInfo,
  RoomPanelComponent,
  PanelRenderContext,
  TabStripRenderContext,
  LayoutPath,
  PanelContainerType,
} from './types';

// New primary exports from mosaic-utils
export {
  makeLayoutStack,
  visitLayoutLeafNodes,
  getVisibleLayoutPanels,
  findLayoutNodePathByKey,
  removeLayoutNodeByKey,
  findTabsNodeForPanel,
  findNodeById,
  findAnyNodeById,
  getNodeAtPath,
  findParentArea,
  findParentSplit,
  getExpandDirection,
  findCollapsedSiblings,
  MOSAIC_NODE_KEY_PREFIX,
  getMosaicNodeKey,
  updateMosaicSubtree,
  convertToMosaicTree,
  convertFromMosaicTree,
  getChildKey,
  isDraggableTile,
} from './mosaic/mosaic-utils';
export type {
  ExpandDirection,
  CollapsedAreaInfo,
  IdentifiedLayoutNode,
} from './mosaic/mosaic-utils';

// Deprecated re-exports from mosaic-utils (old names)
export {
  makeMosaicStack,
  visitMosaicLeafNodes,
  getVisibleMosaicLayoutPanels,
  findMosaicNodePathByKey,
  removeMosaicNodeByKey,
} from './mosaic/mosaic-utils';

// New LayoutRenderer component
export {LayoutRenderer} from './LayoutRenderer';
export type {LayoutRendererProps} from './LayoutRenderer';

// Old MosaicLayout component (kept for mosaic node rendering, but no longer the top-level renderer)
export {default as MosaicLayout} from './mosaic/MosaicLayout';
export type {MosaicLayoutProps} from './mosaic/MosaicLayout';

// New primary exports from @sqlrooms/layout-config
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
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  isLayoutMosaicNode,
  createDefaultLayout,
  // Tabs node helpers
  getLayoutNodeId,
  getChildrenIds,
  getVisibleTabChildren,
  getHiddenTabChildren,
} from '@sqlrooms/layout-config';

// Deprecated re-exports from @sqlrooms/layout-config (old Mosaic* names)
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
} from '@sqlrooms/layout-config';

// Panel matching utility
export {getPanelByPath} from './getPanelByPath';
export {useGetPanelInfoByPath, useGetPanelByPath} from './useGetPanel';

// Node renderers

export {TabsLayout} from './node-renderers/tabs-node-renderer/TabsLayout';
export {useTabsLayoutContext} from './node-renderers/tabs-node-renderer/TabsLayoutProvider';
export {extractPanelId} from './node-renderers/utils';
