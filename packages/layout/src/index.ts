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
export type {ParentDirection} from './layout-base-types';

export {movePanel} from './docking/dock-layout';
export type {DockAxis, DockDirection} from './docking/docking-types-base';
export {
  createLayoutId,
  findNearestDockAncestor,
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
  isLayoutNodeKey,
  isLayoutPanelNode,
  isLayoutTabsNode,
  isLayoutDockNode,
  isLayoutGridNode,
  isLayoutSplitNode,
  LayoutDockNode,
  LayoutConfig,
  LayoutNode,
  LayoutNodeKey,
  LayoutGridNode,
  LayoutPanelNode,
  LayoutSplitNode,
  LayoutTabsNode,
  MAIN_VIEW,
} from '@sqlrooms/layout-config';

export type {LayoutDirection} from '@sqlrooms/layout-config';
export type {LayoutGridItem} from '@sqlrooms/layout-config';

// Panel resolution utilities
export {resolvePanelDefinition} from './resolvePanelDefinition';
export {resolvePanelIdentity} from './resolvePanelIdentity';
export type {PanelIdentityResult} from './resolvePanelIdentity';
export {useGetPanel} from './useGetPanel';

// Layout node context
export {
  getLayoutNodeContextValue,
  LayoutNodeProvider,
  useDockNodeContext,
  useGridNodeContext,
  useLayoutNodeContext,
  useSplitNodeContext,
  useTabsNodeContext,
} from './LayoutNodeContext';
export type {
  LayoutNodeContextDock,
  LayoutNodeContextGrid,
  LayoutNodeContextLeaf,
  LayoutNodeContextPanel,
  LayoutNodeContextSplit,
  LayoutNodeContextTabs,
  LayoutNodeContextValue,
} from './LayoutNodeContext';

// Node renderers
export {LeafLayout} from './node-renderers/leaf-node-renderer/LeafLayout';
export {useExpandGridPanel} from './node-renderers/leaf-node-renderer/useExpandGridPanel';
export {useLeafLayoutPanelDraggable} from './node-renderers/leaf-node-renderer/LeafLayoutPanelDraggableContext';
export {SplitLayout} from './node-renderers/split-node-renderer/SplitLayout';
export {TabsLayout} from './node-renderers/tabs-node-renderer/TabsLayout';
export {DockLayout} from './node-renderers/dock-node-renderer/DockLayout';
export {GridLayout} from './node-renderers/grid-node-renderer/GridLayout';
