import {z} from 'zod';
import {ChartDataPolicyOverrideConfig} from '../data-policy-schema';
import {AggregateFunction} from '../../../schemas';

export const CountPlotMetric = z.enum(['count', 'aggregate']);
export type CountPlotMetric = z.infer<typeof CountPlotMetric>;

export const CountPlotSort = z.enum([
  'value-desc',
  'value-asc',
  'label-asc',
  'label-desc',
]);
export type CountPlotSort = z.infer<typeof CountPlotSort>;

export const CountPlotChartSettings = z.object({
  field: z
    .string()
    .optional()
    .describe('Categorical column to count frequency of values'),
  metric: CountPlotMetric.optional()
    .default('count')
    .describe('Use row count or aggregate a numeric value column per category'),
  valueField: z
    .string()
    .optional()
    .describe('Numeric column to aggregate when metric is aggregate'),
  aggregate: AggregateFunction.optional()
    .default('sum')
    .describe('Aggregation function for valueField'),
  sort: CountPlotSort.optional()
    .default('value-desc')
    .describe('Sort categories by metric value or label'),
  leftMargin: z
    .number()
    .int()
    .min(0)
    .max(320)
    .optional()
    .describe('Manual left margin in pixels; omit to auto-size from metadata'),
});

export type CountPlotChartSettings = z.infer<typeof CountPlotChartSettings>;

export const CountPlotChartConfig = z.object({
  chartType: z.literal('count-plot'),
  settings: CountPlotChartSettings,
  settingsOpen: z.boolean().optional(),
  dataPolicy: ChartDataPolicyOverrideConfig.optional(),
});

export type CountPlotChartConfig = z.infer<typeof CountPlotChartConfig>;
