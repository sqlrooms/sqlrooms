import {z} from 'zod';

export const HeatmapChartSettings = z.object({
  x: z.string().optional().describe('Column for X axis'),
  y: z.string().optional().describe('Column for Y axis'),
});

export type HeatmapChartSettings = z.infer<typeof HeatmapChartSettings>;

export const HeatmapChartConfig = z.object({
  chartType: z.literal('heatmap'),
  settings: HeatmapChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});

export type HeatmapChartConfig = z.infer<typeof HeatmapChartConfig>;
