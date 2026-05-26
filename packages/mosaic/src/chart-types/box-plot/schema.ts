import {z} from 'zod';
import {ChartDataPolicyOverrideConfig} from '../data-policy-schema';

export const BoxPlotChartSettings = z.object({
  x: z.string().describe('Categorical column for grouping'),
  y: z.string().describe('Numeric column for distribution statistics'),
});

export type BoxPlotChartSettings = z.infer<typeof BoxPlotChartSettings>;

export const BoxPlotChartConfig = z.object({
  chartType: z.literal('box-plot'),
  settings: BoxPlotChartSettings,
  settingsOpen: z.boolean().optional(),
  dataPolicy: ChartDataPolicyOverrideConfig.optional(),
});

export type BoxPlotChartConfig = z.infer<typeof BoxPlotChartConfig>;
