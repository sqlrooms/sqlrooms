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
export type {
  RoomPanelInfo,
  LayoutSliceState,
  CreateLayoutSliceProps,
} from './LayoutSlice';

export {
  makeMosaicStack,
  visitMosaicLeafNodes,
  getVisibleMosaicLayoutPanels,
  findMosaicNodePathByKey,
  removeMosaicNodeByKey,
  findAreaById,
  findSplitById,
  findMosaicNodeById,
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
} from './mosaic/mosaic-utils';
export type {ExpandDirection, CollapsedAreaInfo} from './mosaic/mosaic-utils';

export {default as MosaicLayout} from './mosaic/MosaicLayout';
export type {MosaicLayoutProps} from './mosaic/MosaicLayout';

// Re-export from @sqlrooms/layout-config
// Values also export their corresponding types automatically
export {
  MAIN_VIEW,
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
  LayoutConfig,
} from '@sqlrooms/layout-config';
