/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {DeckMap} from './DeckMap';
export {createDeckJsonConfiguration} from './json/createDeckJsonConfiguration';
export {prepareDeckDataset} from './prepare/prepareDeckDataset';

export type {
  DeckDatasetInput,
  DeckMapProps,
  DeckQueryResultLike,
  PreparedDeckDatasetState,
  SqlroomsColorScale,
  SqlroomsColorScaleProp,
  SqlroomsDeckLayerProps,
} from './types';
export type {
  GeometryEncodingHint,
  PreparedDeckDataset,
  PreparedGeoArrowLayerData,
  ResolvedGeometryColumn,
  ResolvedGeometryEncoding,
} from './prepare/types';
