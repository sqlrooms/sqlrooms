import {z} from 'zod';
import {ChartDataPolicyOverrideConfig} from '../data-policy-schema';

export const ScatterChartSettings = z.object({
  x: z.string().optional().describe('Numeric column for X axis position'),
  y: z.string().optional().describe('Numeric column for Y axis position'),
  size: z
    .string()
    .optional()
    .describe('Numeric column for point size (optional)'),
});

export type ScatterChartSettings = z.infer<typeof ScatterChartSettings>;

export const ScatterChartConfig = z.object({
  chartType: z.literal('scatter-chart'),
  settings: ScatterChartSettings,
  settingsOpen: z.boolean().optional(),
  dataPolicy: ChartDataPolicyOverrideConfig.optional(),
});

export type ScatterChartConfig = z.infer<typeof ScatterChartConfig>;
