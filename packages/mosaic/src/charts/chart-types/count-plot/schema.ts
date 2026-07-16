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

export const DEFAULT_COUNT_PLOT_MAX_BARS = 10;
export const MIN_COUNT_PLOT_MAX_BARS = 1;
export const MAX_COUNT_PLOT_MAX_BARS = 100;

export const CountPlotChartSettings = z.object({
  field: z
    .string()
    .optional()
    .describe('Categorical column used to group the horizontal bars'),
  metric: CountPlotMetric.optional()
    .default('count')
    .describe(
      'Use row count for repeated raw observations or aggregate for an existing numeric measure',
    ),
  valueField: z
    .string()
    .optional()
    .describe('Numeric measure column to aggregate when metric is aggregate'),
  aggregate: AggregateFunction.optional()
    .default('sum')
    .describe('Aggregation function for valueField'),
  sort: CountPlotSort.optional()
    .default('value-desc')
    .describe('Sort categories by metric value or label'),
  maxBars: z
    .number()
    .int()
    .min(MIN_COUNT_PLOT_MAX_BARS)
    .max(MAX_COUNT_PLOT_MAX_BARS)
    .optional()
    .default(DEFAULT_COUNT_PLOT_MAX_BARS)
    .describe('Maximum number of category bars to display'),
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
