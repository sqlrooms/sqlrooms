import {z} from 'zod';

export const LineChartSettings = z.object({
  x: z.string().optional(),
  y: z.string().optional(),
});

export type LineChartSettings = z.infer<typeof LineChartSettings>;

export const LineChartConfig = z.object({
  chartType: z.literal('line-chart'),
  settings: LineChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});

export type LineChartConfig = z.infer<typeof LineChartConfig>;
