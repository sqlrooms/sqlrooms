import {z} from 'zod';
import {ChartDataPolicyOverrideConfig} from '../data-policy-schema';
import {TemporalInterval, AggregateFunction} from '../../../schemas';

// Y-field configuration
export const YFieldConfig = z.object({
  field: z.string().describe('Numeric column name to plot on Y axis'),
  color: z.string().optional().describe('Optional color for this line'),
  aggregate: AggregateFunction.optional()
    .default('sum')
    .describe('Aggregation function: sum, avg, min, or max'),
});
export type YFieldConfig = z.infer<typeof YFieldConfig>;

export const LineChartSettings = z.object({
  x: z
    .string()
    .optional()
    .describe('Column for X axis, typically temporal (date/time)'),
  xInterval: TemporalInterval.optional().describe(
    'Temporal binning interval: year, month, day, hour, etc.',
  ),
  yFields: z
    .array(YFieldConfig)
    .optional()
    .describe('Array of Y fields to plot, supports multiple lines'),
});

export type LineChartSettings = z.infer<typeof LineChartSettings>;

export const LineChartConfig = z.object({
  chartType: z.literal('line-chart'),
  settings: LineChartSettings,
  settingsOpen: z.boolean().optional(),
  dataPolicy: ChartDataPolicyOverrideConfig.optional(),
});

export type LineChartConfig = z.infer<typeof LineChartConfig>;
