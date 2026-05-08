import {z} from 'zod';

export const HeatmapChartSettings = z.object({
  x: z.string().optional().describe('Column for X axis'),
  y: z.string().optional().describe('Column for Y axis'),
});

export type HeatmapChartSettings = z.infer<typeof HeatmapChartSettings>;

// For AI-generated charts, we want to require all settings to ensure a complete spec can be generated
export const HeatmapAiChartSettings = HeatmapChartSettings.required();
export type HeatmapAiChartSettings = z.infer<typeof HeatmapAiChartSettings>;

export const HeatmapChartConfig = z.object({
  chartType: z.literal('heatmap'),
  settings: HeatmapChartSettings,
  settingsOpen: z.boolean().optional(),
});

export type HeatmapChartConfig = z.infer<typeof HeatmapChartConfig>;
