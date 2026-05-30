import {z} from 'zod';

export const BaseChartToolParameters = z.object({
  artifactId: z
    .string()
    .optional()
    .describe(
      'Optional dashboard artifact ID. Prefer passing this explicitly; if omitted, the host may use an unambiguous primary dashboard context.',
    ),
  tableName: z
    .string()
    .optional()
    .describe('Optional table name. Use when no table is selected yet.'),
  createArtifactIfMissing: z
    .boolean()
    .optional()
    .default(true)
    .describe('If true, create dashboard artifact if missing.'),
  panelId: z
    .string()
    .optional()
    .describe(
      'Optional panel ID. If provided, updates the existing panel instead of creating new one.',
    ),
  reasoning: z.string().describe('Brief rationale for the chart choice.'),
});
