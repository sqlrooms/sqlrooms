import {z} from 'zod';

const QuerySchema = z.object({
  id: z.string().describe('Query identifier.'),
  name: z.string().describe('Query name.'),
  query: z.string().describe('SQL query to execute.'),
});

// Saved state (persisted)
export const SqlEditorSliceConfig = z.object({
  queries: z.array(QuerySchema),
  selectedQueryId: z
    .string()
    .describe('The id of the currently selected query.'),
  lastExecutedQuery: z.string().optional().describe('Last executed query'),
  openTabs: z.array(z.string()).describe('IDs of open tabs'),
});

export type SqlEditorSliceConfig = z.infer<typeof SqlEditorSliceConfig>;

/**
 * Migrates legacy config with closedTabIds to new format with openTabs.
 */
export const SqlEditorSliceConfigMigration = z.preprocess((data) => {
  if (typeof data !== 'object' || data === null) return data;
  const obj = data as Record<string, unknown>;

  // If already has openTabs, no migration needed
  if ('openTabs' in obj) return data;

  // Migrate from closedTabIds to openTabs
  if ('closedTabIds' in obj && 'queries' in obj) {
    const closedTabIds = obj.closedTabIds as string[];
    const queries = obj.queries as Array<{id: string}>;
    const openTabs = queries
      .map((q) => q.id)
      .filter((id) => !closedTabIds.includes(id));

    const {closedTabIds: _, ...rest} = obj;
    return {...rest, openTabs};
  }

  return data;
}, SqlEditorSliceConfig);

export function createDefaultSqlEditorConfig(): SqlEditorSliceConfig {
  return {
    queries: [{id: 'default', name: 'SQL', query: ''}],
    selectedQueryId: 'default',
    openTabs: ['default'],
  };
}
