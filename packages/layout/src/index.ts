/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  createDefaultLayoutConfig,
  createLayoutSlice,
  LayoutSliceConfig,
  useStoreWithLayout,
} from './LayoutSlice';
export type {CreateLayoutSliceProps, LayoutSliceState} from './LayoutSlice';
export type {
  LayoutPath,
  PanelContainerType,
  PanelDefinition,
  PanelDefinitionContext,
  Panels,
  RoomPanelComponent,
  RoomPanelInfo,
} from './types';

// New primary exports from mosaic-utils
export {
  convertFromMosaicTree,
  convertToMosaicTree,
  findLayoutNodePathByKey,
  findNodeById,
  findParentArea,
  findParentSplit,
  findTabsNodeForPanel,
  getChildKey,
  getExpandDirection,
  getMosaicNodeKey,
  getNodeAtPath,
  getVisibleLayoutPanels,
  isDraggableTile,
  makeLayoutStack,
  MOSAIC_NODE_KEY_PREFIX,
  removeLayoutNodeByKey,
  updateMosaicSubtree,
  visitLayoutLeafNodes,
} from './mosaic/mosaic-utils';
export type {CollapsedAreaInfo, ExpandDirection} from './mosaic/mosaic-utils';

// Deprecated re-exports from mosaic-utils (old names)
export {
  findMosaicNodePathByKey,
  getVisibleMosaicLayoutPanels,
  makeMosaicStack,
  removeMosaicNodeByKey,
  visitMosaicLeafNodes,
} from './mosaic/mosaic-utils';

// New LayoutRenderer component
export {LayoutRenderer} from './LayoutRenderer';
export type {LayoutRendererProps} from './LayoutRenderer';

// New primary exports from @sqlrooms/layout-config
export {
  createDefaultLayout,
  getChildrenIds,
  getHiddenTabChildren,
  // Tabs node helpers
  getLayoutNodeId,
  getVisibleTabChildren,
  isLayoutMosaicNode,
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutConfig,
  LayoutDirection,
  LayoutMosaicNode,
  LayoutNode,
  LayoutNodeKey,
  LayoutPanelNode,
  LayoutSplitNode,
  LayoutTabsNode,
  MAIN_VIEW,
} from '@sqlrooms/layout-config';

// Panel matching utility
export {getPanelByPath} from './getPanelByPath';
export {resolvePanelDefinition} from './resolvePanelDefinition';
export {useGetPanelByPath, useGetPanelInfoByPath} from './useGetPanel';

// Layout node context
export {
  getLayoutNodeContextValue,
  LayoutNodeProvider,
  useLayoutNodeContext,
  useTabsNodeContext,
} from './LayoutNodeContext';
export type {
  LayoutNodeContextLeaf,
  LayoutNodeContextMosaic,
  LayoutNodeContextPanel,
  LayoutNodeContextSplit,
  LayoutNodeContextTabs,
  LayoutNodeContextValue,
} from './LayoutNodeContext';

// Node renderers
export {TabsLayout} from './node-renderers/tabs-node-renderer/TabsLayout';
export {SplitLayout} from './node-renderers/split-node-renderer/SplitLayout';
export {extractPanelId} from './node-renderers/utils';
