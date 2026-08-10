/**
 * Pure string-array lists of every supported color scheme name.
 * No d3 imports — safe to import from test environments and non-browser contexts.
 */

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

/** Every scheme name accepted by AI prompts / tolerant scheme casing fixes. */
export const allKnownColorSchemeNames = [
  ...continuousSequentialSchemes,
  ...continuousDivergingSchemes,
  ...categoricalSchemes,
] as const;

/**
 * Prompt fragment listing exact scheme names (case-sensitive).
 * Keep AI instructions generated from this so surfaces cannot drift.
 */
export function formatColorSchemePromptLists(): string {
  return (
    `sequential — ${continuousSequentialSchemes.join(', ')}. ` +
    `Diverging — ${continuousDivergingSchemes.join(', ')}. ` +
    `Categorical — ${categoricalSchemes.join(', ')}.`
  );
}
