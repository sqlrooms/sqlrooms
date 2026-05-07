import {z} from 'zod';

export const CountPlotChartSettings = z.object({
  field: z.string().optional(),
});

export type CountPlotChartSettings = z.infer<typeof CountPlotChartSettings>;

export const CountPlotChartConfig = z.object({
  chartType: z.literal('count-plot'),
  settings: CountPlotChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});

export type CountPlotChartConfig = z.infer<typeof CountPlotChartConfig>;
