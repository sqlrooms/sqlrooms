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

export const BubbleChartConfig = z.object({
  chartType: z.literal('bubble-chart'),
  settings: BubbleChartSettings,
  settingsOpen: z.boolean().optional(),
});

export type BubbleChartConfig = z.infer<typeof BubbleChartConfig>;
