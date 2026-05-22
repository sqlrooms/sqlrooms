import {z} from 'zod';
import {ChartDataPolicyOverrideConfig} from '../data-policy-schema';

export const CustomSpecChartSettings = z.object({
  vgPlotSpec: z.unknown().optional(),
});

export type CustomSpecChartSettings = z.infer<typeof CustomSpecChartSettings>;

export const CustomSpecChartConfig = z.object({
  chartType: z.literal('custom-spec'),
  settingsOpen: z.boolean().optional(),
  settings: CustomSpecChartSettings,
  dataPolicy: ChartDataPolicyOverrideConfig.optional(),
});

export type CustomSpecChartConfig = z.infer<typeof CustomSpecChartConfig>;
