import {z} from 'zod';

// Temporal interval enum
export const TemporalInterval = z.enum([
  'year',
  'quarter',
  'month',
  'week',
  'day',
  'hour',
  'minute',
  'second',
]);
export type TemporalInterval = z.infer<typeof TemporalInterval>;

// Aggregate function enum
export const AggregateFunction = z.enum(['sum', 'avg']);
export type AggregateFunction = z.infer<typeof AggregateFunction>;

// Y-field configuration
export const YFieldConfig = z.object({
  field: z.string(),
  color: z.string().optional(),
  aggregate: AggregateFunction.optional().default('sum'),
});
export type YFieldConfig = z.infer<typeof YFieldConfig>;

export const LineChartSettings = z.object({
  x: z.string().optional(),
  xInterval: TemporalInterval.optional(),
  yFields: z.array(YFieldConfig).min(1),
});

export type LineChartSettings = z.infer<typeof LineChartSettings>;

export const LineChartConfig = z.object({
  chartType: z.literal('line-chart'),
  settings: LineChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});

export type LineChartConfig = z.infer<typeof LineChartConfig>;
