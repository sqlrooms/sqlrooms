/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {ColorScaleLegend} from './ColorScaleLegend';
export {
  binnedNumericSchemes,
  categoricalSchemeColors,
  categoricalSchemes,
  continuousDivergingInterpolators,
  continuousDivergingSchemes,
  continuousSequentialInterpolators,
  continuousSequentialSchemes,
} from './colorSchemes';
export type {
  BinnedNumericScheme,
  CategoricalScheme,
  ColorScaleScheme,
  ContinuousDivergingScheme,
  ContinuousSequentialScheme,
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
