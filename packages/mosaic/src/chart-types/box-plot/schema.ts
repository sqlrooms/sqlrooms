import {z} from 'zod';

export const BoxPlotChartSettings = z.object({
  x: z.string().optional(),
  y: z.string().optional(),
});

export type BoxPlotChartSettings = z.infer<typeof BoxPlotChartSettings>;

export const BoxPlotChartConfig = z.object({
  chartType: z.literal('box-plot'),
  settings: BoxPlotChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});

export type BoxPlotChartConfig = z.infer<typeof BoxPlotChartConfig>;
