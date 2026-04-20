/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {ColorScaleLegend} from '@sqlrooms/color-scales';
export {DeckJsonMap} from './DeckJsonMap';
export {
  DeckColorScaleProp,
  GeometryEncodingHint as DeckGeometryEncodingHint,
  DeckJsonMapLayerSpec,
  DeckJsonMapSpec,
  LayerExtensionConfig,
  LayerExtensionProps,
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
  DeckArrowTableDatasetInput,
  DeckDatasetInput,
  DeckJsonMapProps,
  DeckSqlDatasetInput,
  PreparedDeckDatasetState,
} from './types';
