import {z} from 'zod';

export const HistogramChartSettings = z.object({
  field: z
    .string()
    .optional()
    .describe('Numeric column to create histogram distribution for'),
});

export type HistogramChartSettings = z.infer<typeof HistogramChartSettings>;

export const HistogramChartConfig = z.object({
  chartType: z.literal('histogram'),
  settings: HistogramChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});

export type HistogramChartConfig = z.infer<typeof HistogramChartConfig>;
