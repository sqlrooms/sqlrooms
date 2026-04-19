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

export type LayerColorScaleProp = 'getFillColor' | 'getLineColor';
export type LayerColorLegendConfig =
  | false
  | {
      title?: string;
    };

export type ContinuousSequentialScheme =
  | 'Blues'
  | 'BuGn'
  | 'BuPu'
  | 'Cividis'
  | 'Cool'
  | 'CubehelixDefault'
  | 'GnBu'
  | 'Greens'
  | 'Greys'
  | 'Inferno'
  | 'Magma'
  | 'OrRd'
  | 'Oranges'
  | 'Plasma'
  | 'PuBu'
  | 'PuBuGn'
  | 'PuRd'
  | 'Purples'
  | 'RdPu'
  | 'Reds'
  | 'Turbo'
  | 'Viridis'
  | 'Warm'
  | 'YlGn'
  | 'YlGnBu'
  | 'YlOrBr'
  | 'YlOrRd'
  | 'Rainbow'
  | 'Sinebow';

export type ContinuousDivergingScheme =
  | 'BrBG'
  | 'PRGn'
  | 'PiYG'
  | 'PuOr'
  | 'RdBu'
  | 'RdGy'
  | 'RdYlBu'
  | 'RdYlGn'
  | 'Spectral';

export type BinnedNumericScheme =
  | 'Blues'
  | 'BuGn'
  | 'BuPu'
  | 'GnBu'
  | 'Greens'
  | 'Greys'
  | 'OrRd'
  | 'Oranges'
  | 'PuBu'
  | 'PuBuGn'
  | 'PuRd'
  | 'Purples'
  | 'RdPu'
  | 'Reds'
  | 'YlGn'
  | 'YlGnBu'
  | 'YlOrBr'
  | 'YlOrRd'
  | 'BrBG'
  | 'PRGn'
  | 'PiYG'
  | 'PuOr'
  | 'RdBu'
  | 'RdGy'
  | 'RdYlBu'
  | 'RdYlGn'
  | 'Spectral';

export type CategoricalScheme =
  | 'Accent'
  | 'Dark2'
  | 'Paired'
  | 'Pastel1'
  | 'Pastel2'
  | 'Set1'
  | 'Set2'
  | 'Set3'
  | 'Tableau10'
  | 'Observable10'
  | 'Category10';

export type LayerColorScale =
  | {
      prop?: LayerColorScaleProp;
      field: string;
      type: 'sequential';
      scheme: ContinuousSequentialScheme;
      domain: 'auto' | [number, number];
      clamp?: boolean;
      reverse?: boolean;
      nullColor?: [number, number, number, number?];
      legend?: LayerColorLegendConfig;
    }
  | {
      prop?: LayerColorScaleProp;
      field: string;
      type: 'diverging';
      scheme: ContinuousDivergingScheme;
      domain: 'auto' | [number, number, number];
      clamp?: boolean;
      reverse?: boolean;
      nullColor?: [number, number, number, number?];
      legend?: LayerColorLegendConfig;
    }
  | {
      prop?: LayerColorScaleProp;
      field: string;
      type: 'quantize';
      scheme: BinnedNumericScheme;
      domain: 'auto' | [number, number];
      bins?: number;
      clamp?: boolean;
      reverse?: boolean;
      nullColor?: [number, number, number, number?];
      legend?: LayerColorLegendConfig;
    }
  | {
      prop?: LayerColorScaleProp;
      field: string;
      type: 'quantile';
      scheme: BinnedNumericScheme;
      bins?: number;
      reverse?: boolean;
      nullColor?: [number, number, number, number?];
      legend?: LayerColorLegendConfig;
    }
  | {
      prop?: LayerColorScaleProp;
      field: string;
      type: 'threshold';
      scheme: BinnedNumericScheme;
      thresholds: number[];
      reverse?: boolean;
      nullColor?: [number, number, number, number?];
      legend?: LayerColorLegendConfig;
    }
  | {
      prop?: LayerColorScaleProp;
      field: string;
      type: 'categorical';
      scheme: CategoricalScheme;
      reverse?: boolean;
      unknownColor?: [number, number, number, number?];
      nullColor?: [number, number, number, number?];
      legend?: LayerColorLegendConfig;
    };

export type LayerExtensionConfig = {
  dataset?: string;
  geometryColumn?: string;
  geometryEncodingHint?: GeometryEncodingHint;
  colorScale?: LayerColorScale;
};

export type LayerExtensionProps = {
  _sqlrooms?: LayerExtensionConfig;
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
