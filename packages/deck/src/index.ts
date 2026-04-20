/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  DeckColorScaleProp,
  DeckJsonMapLayerSpec,
  DeckJsonMapSpec,
  GeometryEncodingHint as DeckGeometryEncodingHint,
  LayerExtensionConfig,
  LayerExtensionProps,
} from './DeckSpec';
export {DeckJsonMap} from './DeckMap';
export {ColorScaleLegend} from '@sqlrooms/color-scales';
export {createDeckJsonConfiguration} from './json/createDeckJsonConfiguration';
export {prepareDeckDataset} from './prepare/prepareDeckDataset';

export type {
  DeckArrowTableDatasetInput,
  DeckDatasetInput,
  DeckJsonMapProps,
  DeckQueryResultLike,
  DeckQueryResultDatasetInput,
  DeckSqlDatasetInput,
  PreparedDeckDatasetState,
} from './types';
export {
  isArrowTableDatasetInput,
  isQueryResultDatasetInput,
  isSqlDatasetInput,
} from './types';
export type {ColorLegendConfig, ColorScaleConfig} from '@sqlrooms/color-scales';
export type {
  GeometryEncodingHint,
  PreparedDeckDataset,
  PreparedGeoArrowLayerData,
  ResolvedGeometryColumn,
  ResolvedGeometryEncoding,
} from './prepare/types';
