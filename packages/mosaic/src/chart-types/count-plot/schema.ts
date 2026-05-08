import {z} from 'zod';

export const CountPlotChartSettings = z.object({
  field: z
    .string()
    .optional()
    .describe('Categorical column to count frequency of values'),
});

export type CountPlotChartSettings = z.infer<typeof CountPlotChartSettings>;

// For AI-generated charts, we want to require all settings to ensure a complete spec can be generated
export const CountPlotAiChartSettings = CountPlotChartSettings.required();
export type CountPlotAiChartSettings = z.infer<typeof CountPlotAiChartSettings>;

export const CountPlotChartConfig = z.object({
  chartType: z.literal('count-plot'),
  settings: CountPlotChartSettings,
  settingsOpen: z.boolean().optional(),
});

export type CountPlotChartConfig = z.infer<typeof CountPlotChartConfig>;
