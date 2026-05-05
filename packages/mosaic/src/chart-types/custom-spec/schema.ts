import {z} from 'zod';

export const CustomSpecChartSettings = z.record(z.string(), z.unknown());

export type CustomSpecChartSettings = z.infer<typeof CustomSpecChartSettings>;

export const CustomSpecChartConfig = z.object({
  chartType: z.literal('custom-spec'),
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
  settings: CustomSpecChartSettings,
});

export type CustomSpecChartConfig = z.infer<typeof CustomSpecChartConfig>;
