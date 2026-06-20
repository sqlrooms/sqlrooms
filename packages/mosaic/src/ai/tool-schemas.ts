import {z} from 'zod';

export const BaseChartToolInput = z.object({
  tableName: z
    .string()
    .describe('REQUIRED table name to create the chart from.'),
  title: z
    .string()
    .optional()
    .default('Chart')
    .describe('Optional title for the chart artifact'),
  reasoning: z.string().describe('Brief rationale for the chart choice.'),
});
