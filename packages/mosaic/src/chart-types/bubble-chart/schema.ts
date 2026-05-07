import {z} from 'zod';

export const BubbleChartSettings = z.object({
  x: z.string().optional(),
  y: z.string().optional(),
});

export type BubbleChartSettings = z.infer<typeof BubbleChartSettings>;

export const BubbleChartConfig = z.object({
  chartType: z.literal('bubble-chart'),
  settings: BubbleChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});

export type BubbleChartConfig = z.infer<typeof BubbleChartConfig>;
