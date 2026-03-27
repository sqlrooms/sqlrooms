/**
 * {@include ../README.md}
 * @packageDocumentation
 */

// Values also export their corresponding types automatically (Zod pattern)
export {
  BaseRoomConfig,
  DEFAULT_ROOM_TITLE,
  createDefaultBaseRoomConfig,
} from './BaseRoomConfig';

export {
  DataSourceTypes,
  BaseDataSource,
  FileDataSource,
  UrlDataSource,
  SqlQueryDataSource,
  DataSource,
  isFileDataSource,
  isUrlDataSource,
  isSqlQueryDataSource,
} from './DataSource';

export {
  LoadFile,
  StandardLoadOptions,
  SpatialLoadOptions,
  SpatialLoadFileOptions,
  isSpatialLoadFileOptions,
  StandardLoadFileOptions,
  LoadFileOptions,
} from './LoadOptions';

// Re-export from @sqlrooms/layout-config — new names
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
} from '@sqlrooms/layout-config';

// Re-export from @sqlrooms/layout-config — deprecated names
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
