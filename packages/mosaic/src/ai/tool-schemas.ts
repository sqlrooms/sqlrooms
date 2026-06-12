import {z} from 'zod';

export const BaseChartToolParameters = z.object({
  tableName: z
    .string()
    .describe('REQUIRED table name to create the chart from.'),
  reasoning: z.string().describe('Brief rationale for the chart choice.'),
});
