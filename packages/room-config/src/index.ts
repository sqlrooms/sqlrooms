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
  GeoJsonXyzmLoadFileOptions,
  isGeoJsonXyzmLoadFileOptions,
} from './LoadOptions';

// Re-export from @sqlrooms/layout-config
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
