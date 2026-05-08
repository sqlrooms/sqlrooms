import {z} from 'zod';

export const BubbleChartSettings = z.object({
  x: z.string().optional().describe('Numeric column for X axis position'),
  y: z.string().optional().describe('Numeric column for Y axis position'),
  size: z
    .string()
    .optional()
    .describe('Numeric column for bubble size (optional)'),
});

export type BubbleChartSettings = z.infer<typeof BubbleChartSettings>;

// For AI-generated charts, we want to require all settings to ensure a complete spec can be generated
export const BubbleChartAiChartSettings = BubbleChartSettings.required();
export type BubbleChartAiChartSettings = z.infer<
  typeof BubbleChartAiChartSettings
>;

export const BubbleChartConfig = z.object({
  chartType: z.literal('bubble-chart'),
  settings: BubbleChartSettings,
  settingsOpen: z.boolean().optional(),
});

export type BubbleChartConfig = z.infer<typeof BubbleChartConfig>;
