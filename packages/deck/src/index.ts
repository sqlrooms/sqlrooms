/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  DeckColorScaleProp,
  DeckMapLayerSpec,
  DeckMapSpec,
  GeometryEncodingHint as DeckGeometryEncodingHint,
  LayerExtensionConfig,
  LayerExtensionProps,
} from './DeckSpec';
export {DeckMap} from './DeckMap';
export {ColorScaleLegend} from '@sqlrooms/color-scales';
export {createDeckJsonConfiguration} from './json/createDeckJsonConfiguration';
export {prepareDeckDataset} from './prepare/prepareDeckDataset';

export type {
  DeckDatasetInput,
  DeckMapProps,
  DeckQueryResultLike,
  PreparedDeckDatasetState,
} from './types';
export type {ColorLegendConfig, ColorScaleConfig} from '@sqlrooms/color-scales';
export type {
  GeometryEncodingHint,
  PreparedDeckDataset,
  PreparedGeoArrowLayerData,
  ResolvedGeometryColumn,
  ResolvedGeometryEncoding,
} from './prepare/types';
