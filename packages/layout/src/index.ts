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
} from './mosaic/mosaic-utils';

export {default as MosaicLayout} from './mosaic/MosaicLayout';

// Re-export from @sqlrooms/layout-config
// Values also export their corresponding types automatically
export {
  MAIN_VIEW,
  LayoutTypes,
  DEFAULT_MOSAIC_LAYOUT,
  createDefaultMosaicLayout,
  MosaicLayoutDirection,
  MosaicLayoutParent,
  isMosaicLayoutParent,
  MosaicLayoutNodeKey,
  MosaicLayoutNode,
  MosaicLayoutConfig,
  LayoutConfig,
} from '@sqlrooms/layout-config';
