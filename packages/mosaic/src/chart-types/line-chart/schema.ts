import {z} from 'zod';

export const LineChartSettings = z.object({
  x: z.string().optional(),
  xInterval: z
    .enum([
      'year',
      'quarter',
      'month',
      'week',
      'day',
      'hour',
      'minute',
      'second',
    ])
    .optional(),
  yFields: z
    .array(
      z.object({
        field: z.string(),
        color: z.string().optional(),
        aggregate: z.enum(['sum', 'avg']).optional().default('sum'),
      }),
    )
    .min(1),
});

export type LineChartSettings = z.infer<typeof LineChartSettings>;

export const LineChartConfig = z.object({
  chartType: z.literal('line-chart'),
  settings: LineChartSettings,
  vgplot: z.unknown(),
  settingsOpen: z.boolean().optional(),
});

export type LineChartConfig = z.infer<typeof LineChartConfig>;
