import {z} from 'zod';
import {ChartDataPolicyOverrideConfig} from '../data-policy-schema';

export const ScatterPlotChartSettings = z.object({
  x: z.string().nullish().describe('Numeric column for X axis position'),
  y: z.string().nullish().describe('Numeric column for Y axis position'),
  size: z
    .string()
    .nullish()
    .describe('Numeric column for point size (optional)'),
});

export type ScatterPlotChartSettings = z.infer<typeof ScatterPlotChartSettings>;

export const ScatterPlotChartConfig = z.object({
  chartType: z.literal('scatter-plot'),
  settings: ScatterPlotChartSettings,
  settingsOpen: z.boolean().optional(),
  dataPolicy: ChartDataPolicyOverrideConfig.optional(),
});

export type ScatterPlotChartConfig = z.infer<typeof ScatterPlotChartConfig>;
