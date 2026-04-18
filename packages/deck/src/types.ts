import type {DeckProps} from '@deck.gl/core';
import type * as arrow from 'apache-arrow';
import type {ReactNode} from 'react';
import type {MapProps} from 'react-map-gl/maplibre';
import type {GeometryEncodingHint, PreparedDeckDataset} from './prepare/types';

export type DeckQueryResultLike = {
  arrowTable?: arrow.Table | undefined;
};

export type DeckDatasetInput = {
  sqlQuery?: string;
  arrowTable?: arrow.Table;
  queryResult?: DeckQueryResultLike;
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
};

export type PreparedDeckDatasetState =
  | {status: 'loading'}
  | {status: 'ready'; prepared: PreparedDeckDataset}
  | {status: 'error'; error: Error};

export type SqlroomsDeckLayerConfig = {
  dataset?: string;
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
};

export type SqlroomsDeckLayerProps = {
  _sqlrooms?: SqlroomsDeckLayerConfig;
};

export type DeckMapProps = {
  spec: string | Record<string, unknown>;
  datasets?: Record<string, DeckDatasetInput>;
  sqlQuery?: string;
  arrowTable?: arrow.Table;
  queryResult?: DeckQueryResultLike;
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
  mapStyle?: string;
  deckProps?: Partial<DeckProps>;
  mapProps?: Partial<MapProps>;
  className?: string;
  children?: ReactNode;
};
