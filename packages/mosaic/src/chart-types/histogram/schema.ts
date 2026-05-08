import {z} from 'zod';

// Relaxed version of settings for use in the chart builder, where we want to allow partial settings
export const HistogramChartSettings = z.object({
  field: z
    .string()
    .optional()
    .describe('Numeric column to create histogram distribution for'),
});

export type HistogramChartSettings = z.infer<typeof HistogramChartSettings>;

// For AI-generated charts, we want to require all settings to ensure a complete spec can be generated
export const HistogramAiChartSettings = HistogramChartSettings.required();
export type HistogramAiChartSettings = z.infer<typeof HistogramAiChartSettings>;

// For the chart builder, we want to allow partial settings so that users can start with an incomplete config and fill in the rest through the UI
export const HistogramChartConfig = z.object({
  chartType: z.literal('histogram'),
  settings: HistogramChartSettings,
  settingsOpen: z.boolean().optional(),
});

export type HistogramChartConfig = z.infer<typeof HistogramChartConfig>;
