import {z} from 'zod';
import {ChartDataPolicyOverrideConfig} from '../data-policy-schema';

export const MIN_BINS_COUNT = 1;
export const MAX_BINS_COUNT = 1000;
export const DEFAULT_BINS_COUNT = 20;

export const HistogramChartSettings = z.object({
  field: z
    .string()
    .optional()
    .describe('Numeric column to create histogram distribution for'),
  maxBins: z
    .number()
    .int()
    .min(MIN_BINS_COUNT)
    .max(MAX_BINS_COUNT)
    .default(DEFAULT_BINS_COUNT)
    .optional()
    .describe(
      `Maximum number of bins for the histogram (default: ${DEFAULT_BINS_COUNT})`,
    ),
});

export type HistogramChartSettings = z.infer<typeof HistogramChartSettings>;

export const HistogramChartConfig = z.object({
  chartType: z.literal('histogram'),
  settings: HistogramChartSettings,
  settingsOpen: z.boolean().optional(),
  dataPolicy: ChartDataPolicyOverrideConfig.optional(),
});

export type HistogramChartConfig = z.infer<typeof HistogramChartConfig>;
