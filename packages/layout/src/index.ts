/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  createDefaultLayoutConfig,
  createLayoutSlice,
  useStoreWithLayout,
} from './LayoutSlice';
export type {
  LayoutSliceConfig,
  CreateLayoutSliceProps,
  LayoutSliceState,
} from './layout-slice-types';
export type {
  LayoutPath,
  PanelContainerType,
  PanelDefinition,
  PanelDefinitionContext,
  Panels,
  RoomPanelComponent,
  RoomPanelInfo,
} from './types';
export type {
  ParentDirection,
  MatchResult,
  MatchResultParams,
} from './layout-base-types';

export {movePanel} from './docking/dock-layout';
export type {DockAxis, DockDirection} from './docking/dock-layout';
export {
  createLayoutId,
  findNearestDraggableAncestor,
  findNodeById,
  findTabsNodeForPanel,
  getVisibleLayoutPanels,
  isDockablePanel,
  removeLayoutNodeByKey,
  visitLayoutLeafNodes,
} from './layout-tree';

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
  isLayoutPanelNode,
  isLayoutSplitNode,
  isLayoutTabsNode,
  LayoutConfig,
  LayoutDirection,
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
  useSplitNodeContext,
  useTabsNodeContext,
} from './LayoutNodeContext';
export type {
  LayoutNodeContextLeaf,
  LayoutNodeContextPanel,
  LayoutNodeContextSplit,
  LayoutNodeContextTabs,
  LayoutNodeContextValue,
} from './LayoutNodeContext';

// Node renderers
export {LeafLayout} from './node-renderers/leaf-node-renderer/LeafLayout';
export {SplitLayout} from './node-renderers/split-node-renderer/SplitLayout';
export {TabsLayout} from './node-renderers/tabs-node-renderer/TabsLayout';

export {extractPanelId} from './node-renderers/utils';
