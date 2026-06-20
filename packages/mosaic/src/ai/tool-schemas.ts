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
  panelId: z
    .string()
    .optional()
    .describe(
      'Optional existing dashboard panel ID to update instead of creating a new panel.',
    ),
  reasoning: z.string().describe('Brief rationale for the chart choice.'),
});
