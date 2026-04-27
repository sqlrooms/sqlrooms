import * as chromatic from 'd3-scale-chromatic';

export const continuousSequentialSchemes = [
  'Blues',
  'BuGn',
  'BuPu',
  'Cividis',
  'Cool',
  'CubehelixDefault',
  'GnBu',
  'Greens',
  'Greys',
  'Inferno',
  'Magma',
  'OrRd',
  'Oranges',
  'Plasma',
  'PuBu',
  'PuBuGn',
  'PuRd',
  'Purples',
  'RdPu',
  'Reds',
  'Turbo',
  'Viridis',
  'Warm',
  'YlGn',
  'YlGnBu',
  'YlOrBr',
  'YlOrRd',
  'Rainbow',
  'Sinebow',
] as const;

export const continuousDivergingSchemes = [
  'BrBG',
  'PRGn',
  'PiYG',
  'PuOr',
  'RdBu',
  'RdGy',
  'RdYlBu',
  'RdYlGn',
  'Spectral',
] as const;

export const binnedNumericSchemes = [
  'Blues',
  'BuGn',
  'BuPu',
  'GnBu',
  'Greens',
  'Greys',
  'OrRd',
  'Oranges',
  'PuBu',
  'PuBuGn',
  'PuRd',
  'Purples',
  'RdPu',
  'Reds',
  'YlGn',
  'YlGnBu',
  'YlOrBr',
  'YlOrRd',
  'BrBG',
  'PRGn',
  'PiYG',
  'PuOr',
  'RdBu',
  'RdGy',
  'RdYlBu',
  'RdYlGn',
  'Spectral',
] as const;

export const categoricalSchemes = [
  'Accent',
  'Dark2',
  'Paired',
  'Pastel1',
  'Pastel2',
  'Set1',
  'Set2',
  'Set3',
  'Tableau10',
  'Observable10',
  'Category10',
] as const;

export type ContinuousSequentialScheme =
  (typeof continuousSequentialSchemes)[number];
export type ContinuousDivergingScheme =
  (typeof continuousDivergingSchemes)[number];
export type BinnedNumericScheme = (typeof binnedNumericSchemes)[number];
export type CategoricalScheme = (typeof categoricalSchemes)[number];
export type ColorScaleScheme =
  | ContinuousSequentialScheme
  | ContinuousDivergingScheme
  | BinnedNumericScheme
  | CategoricalScheme;

export const continuousSequentialInterpolators: Record<
  ContinuousSequentialScheme,
  (t: number) => string
> = {
  Blues: chromatic.interpolateBlues,
  BuGn: chromatic.interpolateBuGn,
  BuPu: chromatic.interpolateBuPu,
  Cividis: chromatic.interpolateCividis,
  Cool: chromatic.interpolateCool,
  CubehelixDefault: chromatic.interpolateCubehelixDefault,
  GnBu: chromatic.interpolateGnBu,
  Greens: chromatic.interpolateGreens,
  Greys: chromatic.interpolateGreys,
  Inferno: chromatic.interpolateInferno,
  Magma: chromatic.interpolateMagma,
  OrRd: chromatic.interpolateOrRd,
  Oranges: chromatic.interpolateOranges,
  Plasma: chromatic.interpolatePlasma,
  PuBu: chromatic.interpolatePuBu,
  PuBuGn: chromatic.interpolatePuBuGn,
  PuRd: chromatic.interpolatePuRd,
  Purples: chromatic.interpolatePurples,
  Rainbow: chromatic.interpolateRainbow,
  RdPu: chromatic.interpolateRdPu,
  Reds: chromatic.interpolateReds,
  Sinebow: chromatic.interpolateSinebow,
  Turbo: chromatic.interpolateTurbo,
  Viridis: chromatic.interpolateViridis,
  Warm: chromatic.interpolateWarm,
  YlGn: chromatic.interpolateYlGn,
  YlGnBu: chromatic.interpolateYlGnBu,
  YlOrBr: chromatic.interpolateYlOrBr,
  YlOrRd: chromatic.interpolateYlOrRd,
};

export const continuousDivergingInterpolators: Record<
  ContinuousDivergingScheme,
  (t: number) => string
> = {
  BrBG: chromatic.interpolateBrBG,
  PRGn: chromatic.interpolatePRGn,
  PiYG: chromatic.interpolatePiYG,
  PuOr: chromatic.interpolatePuOr,
  RdBu: chromatic.interpolateRdBu,
  RdGy: chromatic.interpolateRdGy,
  RdYlBu: chromatic.interpolateRdYlBu,
  RdYlGn: chromatic.interpolateRdYlGn,
  Spectral: chromatic.interpolateSpectral,
};

export const discreteNumericSchemes: Record<
  BinnedNumericScheme,
  ReadonlyArray<ReadonlyArray<string>>
> = {
  Blues: chromatic.schemeBlues,
  BuGn: chromatic.schemeBuGn,
  BuPu: chromatic.schemeBuPu,
  GnBu: chromatic.schemeGnBu,
  Greens: chromatic.schemeGreens,
  Greys: chromatic.schemeGreys,
  OrRd: chromatic.schemeOrRd,
  Oranges: chromatic.schemeOranges,
  PuBu: chromatic.schemePuBu,
  PuBuGn: chromatic.schemePuBuGn,
  PuRd: chromatic.schemePuRd,
  Purples: chromatic.schemePurples,
  RdPu: chromatic.schemeRdPu,
  Reds: chromatic.schemeReds,
  YlGn: chromatic.schemeYlGn,
  YlGnBu: chromatic.schemeYlGnBu,
  YlOrBr: chromatic.schemeYlOrBr,
  YlOrRd: chromatic.schemeYlOrRd,
  BrBG: chromatic.schemeBrBG,
  PRGn: chromatic.schemePRGn,
  PiYG: chromatic.schemePiYG,
  PuOr: chromatic.schemePuOr,
  RdBu: chromatic.schemeRdBu,
  RdGy: chromatic.schemeRdGy,
  RdYlBu: chromatic.schemeRdYlBu,
  RdYlGn: chromatic.schemeRdYlGn,
  Spectral: chromatic.schemeSpectral,
};

export const categoricalSchemeColors: Record<
  CategoricalScheme,
  ReadonlyArray<string>
> = {
  Accent: chromatic.schemeAccent,
  Category10: chromatic.schemeCategory10,
  Dark2: chromatic.schemeDark2,
  Observable10: chromatic.schemeObservable10,
  Paired: chromatic.schemePaired,
  Pastel1: chromatic.schemePastel1,
  Pastel2: chromatic.schemePastel2,
  Set1: chromatic.schemeSet1,
  Set2: chromatic.schemeSet2,
  Set3: chromatic.schemeSet3,
  Tableau10: chromatic.schemeTableau10,
};
