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
  PanelDefinitionContext,
  PanelDefinition,
  Panels,
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
  getNodeAtPath,
  findParentArea,
  findParentSplit,
  getExpandDirection,
  MOSAIC_NODE_KEY_PREFIX,
  getMosaicNodeKey,
  updateMosaicSubtree,
  convertToMosaicTree,
  convertFromMosaicTree,
  getChildKey,
  isDraggableTile,
} from './mosaic/mosaic-utils';
export type {ExpandDirection, CollapsedAreaInfo} from './mosaic/mosaic-utils';

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
export {resolvePanelDefinition} from './resolvePanelDefinition';

// Layout node context
export {
  useLayoutNodeContext,
  useTabsNodeContext,
  LayoutNodeProvider,
  getLayoutNodeContextValue,
} from './LayoutNodeContext';
export type {
  LayoutNodeContextValue,
  LayoutNodeContextTabs,
  LayoutNodeContextSplit,
  LayoutNodeContextMosaic,
  LayoutNodeContextPanel,
  LayoutNodeContextLeaf,
} from './LayoutNodeContext';

// Node renderers
export {TabsLayout} from './node-renderers/tabs-node-renderer/TabsLayout';
export {extractPanelId} from './node-renderers/utils';
