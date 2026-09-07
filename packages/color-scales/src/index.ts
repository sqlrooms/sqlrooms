/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {ColorScaleLegend} from './ColorScaleLegend';
export {
  allKnownColorSchemeNames,
  binnedNumericSchemes,
  categoricalSchemes,
  continuousDivergingSchemes,
  continuousSequentialSchemes,
  formatColorSchemePromptLists,
} from './colorSchemeNames';
export type {
  BinnedNumericScheme,
  CategoricalScheme,
  ColorScaleScheme,
  ContinuousDivergingScheme,
  ContinuousSequentialScheme,
} from './colorSchemeNames';
export {
  categoricalSchemeColors,
  continuousDivergingInterpolators,
  continuousSequentialInterpolators,
} from './colorSchemes';
export {ColorLegendConfig, ColorScaleConfig, RGBAColor} from './config';
export type {
  ColorScaleKind,
  ColorScaleValue,
  ResolvedColorLegend,
  ResolvedRGBA,
} from './config';
export {
  buildColorScaleLegend,
  coerceFiniteNumber,
  createColorScaleMapper,
  getDiscreteNumericColors,
  getDivergingDomain,
  getSequentialDomain,
  isCategoricalColorScale,
  isContinuousColorScale,
  isSteppedColorScale,
  normalizeColor,
  parseColorString,
  resolveColorLegendTitle,
} from './scale';
