import {tool} from 'ai';
import {z} from 'zod';

/**
 * Simulated `querySQL` tool. The example has no DuckDB connection — it
 * just echoes the SQL back with a note and a canned 3-row result so the
 * agent can continue its loop without a real database.
 */
export function createQuerySqlTool() {
  return tool({
    description:
      'Run a SQL query against the active database. Returns a small tabular sample. (Simulated in this example — no real database is attached.)',
    inputSchema: z.object({
      reasoning: z
        .string()
        .describe('Why this query is being run — shown in the activity log.'),
      sql: z.string().describe('The SQL query to run.'),
    }),
    execute: async ({sql}: {sql: string}) => ({
      success: true,
      sql,
      note: 'Simulated result — no real database is attached to this example.',
      rows: [
        {column_a: 'alpha', column_b: 1},
        {column_a: 'beta', column_b: 2},
        {column_a: 'gamma', column_b: 3},
      ],
    }),
  });
}
