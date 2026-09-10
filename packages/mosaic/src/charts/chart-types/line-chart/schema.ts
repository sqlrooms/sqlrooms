import {z} from 'zod';
import {ChartDataPolicyOverrideConfig} from '../data-policy-schema';
import {TemporalInterval, AggregateFunction} from '../../../schemas';

// Y-field configuration
export const YFieldConfig = z.object({
  field: z.string().describe('Numeric column name to plot on Y axis'),
  color: z.string().nullish().describe('Optional color for this line'),
  aggregate: AggregateFunction.optional()
    .default('sum')
    .describe('Aggregation function: sum, avg, min, or max'),
});
export type YFieldConfig = z.infer<typeof YFieldConfig>;

export const LineChartSettings = z.object({
  metric: z
    .enum(['aggregate', 'count'])
    .nullish()
    .describe(
      'Use count for row counts (COUNT(*)) with no yFields, or aggregate for numeric Y fields. Omission preserves existing numeric-series behavior.',
    ),
  x: z
    .string()
    .nullish()
    .describe('Column for X axis, typically temporal (date/time)'),
  xInterval: TemporalInterval.nullish().describe(
    'Temporal binning interval: year, month, day, hour, etc.',
  ),
  yFields: z
    .array(YFieldConfig)
    .nullish()
    .describe('Array of Y fields to plot, supports multiple lines'),
  showLegend: z
    .boolean()
    .optional()
    .default(true)
    .describe('Show interactive legend for toggling line visibility'),
});

export type LineChartSettings = z.infer<typeof LineChartSettings>;

export const LineChartConfig = z.object({
  chartType: z.literal('line-chart'),
  settings: LineChartSettings,
  /** Chart-local UI memory, kept outside the active count-series settings. */
  lastAggregateYFields: z.array(YFieldConfig).optional(),
  settingsOpen: z.boolean().optional(),
  dataPolicy: ChartDataPolicyOverrideConfig.optional(),
});

export type LineChartConfig = z.infer<typeof LineChartConfig>;
