import type {DeckProps} from '@deck.gl/core';
import type * as arrow from 'apache-arrow';
import type {ReactNode} from 'react';
import type {MapProps} from 'react-map-gl/maplibre';
import type {GeometryEncodingHint, PreparedDeckDataset} from './prepare/types';

export type {
  DeckColorScaleProp,
  DeckJsonMapLayerSpec,
  DeckJsonMapSpec,
  LayerExtensionConfig,
  LayerExtensionProps,
} from './DeckJsonMapSpec';

type DeckDatasetBase = {
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
};

export type DeckSqlDatasetInput = DeckDatasetBase & {
  sqlQuery: string;
};

export type DeckArrowTableDatasetInput = DeckDatasetBase & {
  arrowTable?: arrow.Table | undefined;
};
export type DeckDatasetInput = DeckSqlDatasetInput | DeckArrowTableDatasetInput;

export type PreparedDeckDatasetState =
  | {status: 'loading'}
  | {status: 'ready'; prepared: PreparedDeckDataset}
  | {status: 'error'; error: Error};

export type DeckJsonMapProps = {
  spec: string | Record<string, unknown>;
  datasets: Record<string, DeckDatasetInput>;
  mapStyle?: string;
  deckProps?: Partial<DeckProps>;
  mapProps?: Partial<MapProps>;
  showLegends?: boolean;
  className?: string;
  children?: ReactNode;
};

export function isSqlDatasetInput(
  input: DeckDatasetInput,
): input is DeckSqlDatasetInput {
  return 'sqlQuery' in input;
}

export function isArrowTableDatasetInput(
  input: DeckDatasetInput,
): input is DeckArrowTableDatasetInput {
  return 'arrowTable' in input;
}
