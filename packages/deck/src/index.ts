/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {DeckMap} from './DeckMap';
export {ColorScaleLegend} from '@sqlrooms/color-scales';
export {createDeckJsonConfiguration} from './json/createDeckJsonConfiguration';
export {prepareDeckDataset} from './prepare/prepareDeckDataset';

export type {
  DeckColorScaleProp,
  DeckDatasetInput,
  DeckMapProps,
  DeckQueryResultLike,
  LayerExtensionProps,
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
