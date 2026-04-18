/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {DeckMap} from './DeckMap';
export {ColorScaleLegend} from './ColorScaleLegend';
export {createDeckJsonConfiguration} from './json/createDeckJsonConfiguration';
export {prepareDeckDataset} from './prepare/prepareDeckDataset';

export type {
  DeckDatasetInput,
  DeckMapProps,
  DeckQueryResultLike,
  LayerColorLegendConfig,
  LayerColorScale,
  LayerColorScaleProp,
  LayerExtensionProps,
  PreparedDeckDatasetState,
} from './types';
export type {
  GeometryEncodingHint,
  PreparedDeckDataset,
  PreparedGeoArrowLayerData,
  ResolvedGeometryColumn,
  ResolvedGeometryEncoding,
} from './prepare/types';
