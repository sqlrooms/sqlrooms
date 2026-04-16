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

// Re-export from @sqlrooms/layout-config
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
