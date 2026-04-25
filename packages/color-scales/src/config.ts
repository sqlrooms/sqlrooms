import {z} from 'zod';
import type {
  BinnedNumericScheme,
  CategoricalScheme,
  ColorScaleScheme,
  ContinuousDivergingScheme,
  ContinuousSequentialScheme,
} from './colorSchemes';
import {
  binnedNumericSchemes,
  categoricalSchemes,
  continuousDivergingSchemes,
  continuousSequentialSchemes,
} from './colorSchemes';

const colorChannel = z.number().int().min(0).max(255);

export const RGBAColor = z.union([
  z.tuple([colorChannel, colorChannel, colorChannel]),
  z.tuple([colorChannel, colorChannel, colorChannel, colorChannel]),
]);
export type RGBAColor = z.infer<typeof RGBAColor>;

export type ResolvedRGBA = [number, number, number, number];
export type ColorScaleValue = string | number | boolean;

export const ColorLegendConfig = z.object({
  title: z.string().optional(),
});
export type ColorLegendConfig = z.infer<typeof ColorLegendConfig>;

const baseNumericScaleConfig = z.object({
  field: z.string().min(1),
  reverse: z.boolean().optional(),
  nullColor: RGBAColor.optional(),
  legend: ColorLegendConfig.optional(),
});

const SequentialColorScaleConfig = baseNumericScaleConfig.extend({
  type: z.literal('sequential'),
  scheme: z.enum(continuousSequentialSchemes),
  domain: z.union([z.literal('auto'), z.tuple([z.number(), z.number()])]),
  clamp: z.boolean().optional(),
});

const DivergingColorScaleConfig = baseNumericScaleConfig.extend({
  type: z.literal('diverging'),
  scheme: z.enum(continuousDivergingSchemes),
  domain: z.union([
    z.literal('auto'),
    z.tuple([z.number(), z.number(), z.number()]),
  ]),
  clamp: z.boolean().optional(),
});

const QuantizeColorScaleConfig = baseNumericScaleConfig.extend({
  type: z.literal('quantize'),
  scheme: z.enum(binnedNumericSchemes),
  domain: z.union([z.literal('auto'), z.tuple([z.number(), z.number()])]),
  bins: z.number().int().positive().optional(),
  clamp: z.boolean().optional(),
});

const QuantileColorScaleConfig = baseNumericScaleConfig.extend({
  type: z.literal('quantile'),
  scheme: z.enum(binnedNumericSchemes),
  bins: z.number().int().positive().optional(),
});

const ThresholdColorScaleConfig = baseNumericScaleConfig.extend({
  type: z.literal('threshold'),
  scheme: z.enum(binnedNumericSchemes),
  thresholds: z.array(z.number()),
});

const CategoricalColorScaleConfig = z.object({
  field: z.string().min(1),
  type: z.literal('categorical'),
  scheme: z.enum(categoricalSchemes),
  reverse: z.boolean().optional(),
  unknownColor: RGBAColor.optional(),
  nullColor: RGBAColor.optional(),
  legend: ColorLegendConfig.optional(),
});

export const ColorScaleConfig = z.discriminatedUnion('type', [
  SequentialColorScaleConfig,
  DivergingColorScaleConfig,
  QuantizeColorScaleConfig,
  QuantileColorScaleConfig,
  ThresholdColorScaleConfig,
  CategoricalColorScaleConfig,
]);
export type ColorScaleConfig = z.infer<typeof ColorScaleConfig>;

export type ResolvedColorLegend =
  | {
      type: 'continuous';
      title: string;
      gradient: string;
      ticks: Array<{label: string; offset: number}>;
    }
  | {
      type: 'stepped';
      title: string;
      items: Array<{label: string; color: ResolvedRGBA}>;
      ticks?: Array<{label: string; offset: number}>;
    }
  | {
      type: 'categorical';
      title: string;
      items: Array<{label: string; color: ResolvedRGBA}>;
    };

export type NumericColorScaleConfig = Extract<
  ColorScaleConfig,
  {type: 'sequential' | 'diverging' | 'quantize' | 'quantile' | 'threshold'}
>;

export type ColorScaleKind = ResolvedColorLegend['type'];
export type {
  BinnedNumericScheme,
  CategoricalScheme,
  ColorScaleScheme,
  ContinuousDivergingScheme,
  ContinuousSequentialScheme,
};
