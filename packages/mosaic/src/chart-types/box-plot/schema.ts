import {z} from 'zod';

export const BoxPlotChartSettings = z.object({
  x: z.string().optional().describe('Categorical column for grouping'),
  y: z
    .string()
    .optional()
    .describe('Numeric column for distribution statistics'),
});

export type BoxPlotChartSettings = z.infer<typeof BoxPlotChartSettings>;

// For AI-generated charts, we want to require all settings to ensure a complete spec can be generated
export const BoxPlotAiChartSettings = BoxPlotChartSettings.required();
export type BoxPlotAiChartSettings = z.infer<typeof BoxPlotAiChartSettings>;

export const BoxPlotChartConfig = z.object({
  chartType: z.literal('box-plot'),
  settings: BoxPlotChartSettings,
  settingsOpen: z.boolean().optional(),
});

export type BoxPlotChartConfig = z.infer<typeof BoxPlotChartConfig>;
