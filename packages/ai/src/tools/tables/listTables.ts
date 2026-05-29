import {
  getAllTablesFromSchemaTrees,
  makeQualifiedTableName,
  type DuckDbSliceState,
} from '@sqlrooms/duckdb';
import {tool} from 'ai';
import {z} from 'zod';
import type {StoreApi} from '@sqlrooms/room-shell';

const ListTablesInput = z.object({
  database: z
    .string()
    .optional()
    .describe('Filter by database name (exact match).'),
  schema: z
    .string()
    .optional()
    .describe('Filter by schema name (exact match).'),
  pattern: z
    .string()
    .optional()
    .describe(
      'Pattern to match table names (SQL LIKE syntax: use % for wildcard, e.g., "user%").',
    ),
  includeViews: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include views in the results. Defaults to true.'),
});

export type ListTablesParameters = z.infer<typeof ListTablesInput>;

export type TableSummary = {
  qualifiedName: string;
  database?: string;
  schema?: string;
  tableName: string;
  isView: boolean;
  columnCount: number;
  rowCount?: number;
};

export type ListTablesOutput = {
  success: boolean;
  tables: TableSummary[];
  totalCount: number;
};

/**
 * Converts SQL LIKE pattern to a JavaScript RegExp.
 * Supports % (any characters) and _ (single character) wildcards.
 */
function likePatternToRegex(pattern: string): RegExp {
  // Escape regex special characters except for % and _
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, 'i'); // case-insensitive
}

export function createListTablesTool(store: StoreApi<DuckDbSliceState>) {
  return tool({
    description:
      'List available tables and views in the database. Supports filtering by database, schema, and table name pattern. Use this to discover what tables exist before reading their schemas.',
    inputSchema: ListTablesInput,
    execute: async (input) => {
      const state = store.getState();
      const allTables = getAllTablesFromSchemaTrees(state.db.schemaTrees);

      // Apply filters
      let filtered = allTables;

      // Filter by database
      if (input.database) {
        filtered = filtered.filter(
          (table) => table.table.database === input.database,
        );
      }

      // Filter by schema
      if (input.schema) {
        filtered = filtered.filter(
          (table) => table.table.schema === input.schema,
        );
      }

      // Filter by pattern
      if (input.pattern) {
        const regex = likePatternToRegex(input.pattern);
        filtered = filtered.filter((table) => regex.test(table.table.table));
      }

      // Filter by views
      if (!input.includeViews) {
        filtered = filtered.filter((table) => !table.isView);
      }

      // Exclude internal SQLRooms schemas
      filtered = filtered.filter(
        (table) => !table.table.schema?.startsWith('__sqlrooms_'),
      );

      // Map to summary format
      const summaries = filtered.map(
        (table) =>
          ({
            qualifiedName: makeQualifiedTableName({
              database: table.table.database,
              schema: table.table.schema,
              table: table.table.table,
            }).toString(),
            database: table.table.database,
            schema: table.table.schema,
            tableName: table.table.table,
            isView: table.isView,
            columnCount: table.columns.length,
            rowCount: table.rowCount,
          }) satisfies TableSummary,
      );

      // Sort by database, schema, table
      summaries.sort((a, b) => {
        const dbA = a.database ?? '';
        const dbB = b.database ?? '';
        if (dbA !== dbB) return dbA.localeCompare(dbB);

        const schemaA = a.schema ?? '';
        const schemaB = b.schema ?? '';
        if (schemaA !== schemaB) return schemaA.localeCompare(schemaB);

        return a.tableName.localeCompare(b.tableName);
      });

      return {
        llmResult: {
          success: true,
          tables: summaries,
          totalCount: summaries.length,
        },
      };
    },
  });
}
