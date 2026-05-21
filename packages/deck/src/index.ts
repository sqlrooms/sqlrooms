/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {ColorScaleLegend} from '@sqlrooms/color-scales';
export {createDeckJsonSpecFromDatasets} from './createDeckJsonSpecFromDatasets';
export {
  createDeckMapAiTools,
  createDeckMapDashboardAiTools,
  createDeckMapDashboardTool,
  createDeckMapConfigTool,
  DeckMapDashboardConfigParameter,
  DeckMapConfigToolParameters,
  DeckMapDashboardToolParameters,
} from './ai';
export type {
  DeckMapConfigToolParams,
  DeckMapDashboardConfigToolConfig,
  DeckMapDashboardToolParams,
} from './ai';
export {
  deckMapDashboardAddPanelAction,
  deckMapDashboardPanelRenderer,
} from './dashboard';
export {
  asDeckJsonMapConfig,
  createDeckMapDashboardDatasetQuery,
  createDeckMapDashboardDatasets,
  createDeckMapDashboardPanelConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  resolveDeckMapDashboardDatasetSource,
} from './dashboardConfig';
export {
  createDeckMapDashboardConfigForTable,
  createDeckMapDashboardPanelConfigForTable,
  findDeckMapLongitudeLatitudeColumns,
  findLongitudeLatitudeColumns,
  normalizeDeckMapFillColor,
  quoteDeckMapSqlIdentifier,
  quoteDeckMapSqlTableReference,
  regenerateMapConfigForTable,
} from './mapConfigUtils';
export type {
  DeckMapConfigColumn,
  DeckMapFillColor,
  DeckMapTableReference,
} from './mapConfigUtils';
export type {
  DeckMapDashboardFitToDataConfig,
  CreateDeckMapDashboardPanelConfigOptions,
  DeckMapDashboardDatasetClientState,
  DeckMapDashboardDatasetConfig,
  DeckMapDashboardInteractionConfig,
  DeckMapDashboardPanelConfig,
} from './dashboardConfig';
export {DeckJsonMap} from './DeckJsonMap';
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
export {isArrowTableDatasetInput, isSqlDatasetInput} from './types';
export type {
  CreateDeckJsonSpecFromDatasetsOptions,
  DeckArrowTableDatasetInput,
  DeckAutoLayerType,
  DeckDatasetInput,
  DeckJsonMapProps,
  DeckJsonSpecDatasetHint,
  DeckSqlDatasetInput,
  DeckTable,
  PreparedDeckDatasetState,
} from './types';
