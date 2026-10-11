import {z} from 'zod';

// Temporal interval enum - used for date/time binning across charts
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

// Aggregate function enum - used for numeric aggregations across charts
export const AggregateFunction = z.enum(['sum', 'avg', 'min', 'max']);
export type AggregateFunction = z.infer<typeof AggregateFunction>;
