import {z} from 'zod';

// Saved state (persisted)
export const SqlEditorSliceConfig = z.object({
  sqlEditor: z.object({
    queries: z.array(
      z.object({
        id: z.string().describe('Query identifier.'),
        name: z.string().describe('Query name.'),
        query: z.string().describe('SQL query to execute.'),
      }),
    ),
    selectedQueryId: z
      .string()
      .default('default')
      .describe('The id of the currently selected query.'),
    lastExecutedQuery: z.string().optional().describe('Last executed query'),
  }),
});
export type SqlEditorSliceConfig = z.infer<typeof SqlEditorSliceConfig>;

export function createDefaultSqlEditorConfig(): SqlEditorSliceConfig {
  return {
    sqlEditor: {
      queries: [{id: 'default', name: 'Untitled', query: ''}],
      selectedQueryId: 'default',
    },
  };
}
