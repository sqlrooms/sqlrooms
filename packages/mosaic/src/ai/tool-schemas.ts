import {z} from 'zod';

/**
 * Base input schema shared by chart AI tools.
 *
 * Includes the source table, optional chart title, optional dashboard panel to
 * update, and the model's rationale for the chart choice.
 */
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
