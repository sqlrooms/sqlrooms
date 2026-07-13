/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {ColorScaleLegend} from '@sqlrooms/color-scales';
export {createDeckJsonSpecFromDatasets} from './createDeckJsonSpecFromDatasets';
export {DeckMapBlockSettings} from './BlockMapSettings';
export {
  DeckMapSettingsPanel,
  type DeckMapSettingsPanelProps,
} from './MapSettings';
export {
  DeckMapBlockRenderer,
  ensureDeckMapResourceState,
  type DeckMapBlockRendererProps,
} from './block';
export {
  asDeckJsonMapConfig,
  createEmptyDeckMapConfig,
  createDeckMapDashboardPanelConfig,
  DEFAULT_DECK_MAP_MAX_DATA_POINTS,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  isDeckMapDashboardSqlDatasetSource,
  isDeckMapDashboardTableDatasetSource,
} from './mapConfig';
export {getDeckMapDataPolicy, type DeckMapDataPolicy} from './mapDataPolicy';
export {
  createDeckMapDashboardConfigForTable,
  createDeckMapConfigForTable,
  createDeckMapDashboardPanelConfigForTable,
  createDeckMapPointTransformSql,
  findDeckMapLongitudeLatitudeColumns,
  findGeometryColumn,
  findLongitudeLatitudeColumns,
  normalizeDeckMapFillColor,
  normalizeDeckMapPointConfig,
  quoteDeckMapSqlIdentifier,
  quoteDeckMapSqlTableReference,
  regenerateMapConfigForTable,
} from './mapConfigUtils';
export type {
  DeckMapConfigColumn,
  DeckMapFillColor,
  DeckMapTableReference,
} from './mapConfigUtils';
export {
  getFirstDatasetSourceTableName,
  hasSqlOnlyDatasetSource,
} from './datasetSourceUtils';
export type {DeckMapDatasetSourceConfig} from './datasetSourceUtils';
export {
  DeckMapResourceConfigParameter,
  DeckMapResourceToolParameters,
} from './mapAiConfig';
export {
  createOrUpdateDeckMapResource,
  type CreateOrUpdateDeckMapResourceHost,
  type CreateOrUpdateDeckMapResourceParams,
  type CreateOrUpdateDeckMapResourceResult,
} from './createOrUpdateDeckMapResource';
export {
  DeckMapEntrySchema,
  DeckMapsSliceConfig,
  createDeckMapsSlice,
  useStoreWithDeckMaps,
} from './DeckMapsSlice';
export type {
  DeckMapEntry,
  DeckMapRuntimeIssue,
  DeckMapRuntimeIssueReporter,
  DeckMapsSliceState,
} from './DeckMapsSlice';
export {
  DeckMapSurface,
  directDeckMapDataAdapter,
  type DeckMapDataAdapter,
  type DeckMapSurfaceProps,
} from './DeckMapSurface';
export {
  DECK_MAP_BLOCK_DEFAULT_HEIGHT,
  DECK_MAP_BLOCK_DEFAULT_TITLE,
  DECK_MAP_BLOCK_TYPE,
  createDeckMapBlockDocumentCommandType,
  createDeckMapBlockDocumentType,
  type DeckMapBlockDocumentRegistrationOptions,
} from './blockDocumentRegistration';
export type {
  DeckMapConfigMode,
  DeckMapDashboardFitToDataConfig,
  CreateDeckMapDashboardPanelConfigOptions,
  DeckMapDashboardDatasetConfig,
  DeckMapDataPolicyOverride,
  DeckMapDashboardInteractionConfig,
  DeckMapDashboardPanelConfig,
  DeckMapConfig,
  DeckMapDatasetConfig,
  DeckMapDatasetSource,
  DeckMapFitToDataConfig,
  DeckMapInteractionConfig,
} from './mapConfig';
export {DeckJsonMap} from './DeckJsonMap';
export {
  DeckMapDefaultStylesProvider,
  resolveDeckMapStyle,
  useDeckMapDefaultStyles,
  type DeckMapDefaultStyles,
  type DeckMapStyle,
} from './DeckMapDefaultStylesProvider';
export {
  ColorScaleFunction,
  GeometryEncodingHint as DeckGeometryEncodingHint,
  DeckJsonMapLayerSpec,
  DeckJsonMapSpec,
  LayerBindingConfig,
  LayerBindingProps,
} from './DeckJsonMapSpec';
export {createDeckJsonConfiguration} from './json/createDeckJsonConfiguration';
export {prepareDeckDataset} from './prepare/prepareDeckDataset';

export type {ColorLegendConfig, ColorScaleConfig} from '@sqlrooms/color-scales';
export type {
  GeometryEncodingHint,
  PreparedDeckDataset,
  PreparedGeoArrowLayerData,
  ResolvedGeometryColumn,
  ResolvedGeometryEncoding,
} from './prepare/types';
export {
  isArrowTableDatasetInput,
  isSqlDatasetInput,
  isTableDatasetInput,
} from './types';
export {
  DECK_TABLE_DATASET_SOURCE_RELATION,
  createDeckTableDatasetSql,
} from './datasets/tableDatasetSql';
export type {
  CreateDeckJsonSpecFromDatasetsOptions,
  DeckArrowTableDatasetInput,
  DeckAutoLayerType,
  DeckDatasetInput,
  DeckJsonMapHandle,
  DeckJsonMapProps,
  DeckJsonSpecDatasetHint,
  DeckSqlDatasetInput,
  DeckTableDatasetInput,
  DeckTable,
  PreparedDeckDatasetState,
} from './types';
