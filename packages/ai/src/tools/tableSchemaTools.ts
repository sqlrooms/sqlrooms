import {tool} from 'ai';
import type {Tool} from 'ai';
import type {AiSliceState} from '@sqlrooms/ai-core';
import type {DataTable, DuckDbSliceState} from '@sqlrooms/duckdb';
import type {StoreApi} from '@sqlrooms/room-shell';
import {z} from 'zod';
import {
  getDatabaseNameForAi,
  getFullTableNameForAi,
  getSchemaNameForAi,
  getTablesForAiScope,
  getTableNameForAi,
} from './tableSchemaContext';

export const ListTablesToolParameters = z.object({
  scope: z
    .enum(['main', 'current_database', 'all'])
    .optional()
    .default('main')
    .describe(
      'Catalog scope to search. main = current database main schema; current_database = all schemas in the current database; all = all visible databases/schemas.',
    ),
  schema: z
    .string()
    .optional()
    .describe(
      'Optional schema filter. If provided, searches that schema within the selected or specified database.',
    ),
  database: z
    .string()
    .optional()
    .describe(
      'Optional database filter. Use with scope "all" or to inspect an attached database.',
    ),
  search: z
    .string()
    .optional()
    .describe(
      'Optional case-insensitive substring to match against table names.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe('Maximum number of tables to return (default: 50, max: 200).'),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe('Number of matching tables to skip before returning results.'),
});

export type ListTablesToolParameters = z.infer<typeof ListTablesToolParameters>;

export const DescribeTableSchemaToolParameters = z.object({
  tableName: z
    .string()
    .describe(
      'Table name to describe. Can be the bare table name, schema.table, or database.schema.table.',
    ),
  scope: z
    .enum(['main', 'current_database', 'all'])
    .optional()
    .default('main')
    .describe(
      'Catalog scope to search when schema/database are not provided. main = current database main schema; current_database = all schemas in the current database; all = all visible databases/schemas.',
    ),
  schema: z
    .string()
    .optional()
    .describe('Optional schema name. Available tables are usually in main.'),
  database: z
    .string()
    .optional()
    .describe('Optional database name for disambiguation.'),
});

export type DescribeTableSchemaToolParameters = z.infer<
  typeof DescribeTableSchemaToolParameters
>;

export type TableSchemaToolColumn = {
  name: string;
  type?: string;
};

export type TableSchemaToolTable = {
  tableName: string;
  fullTableName: string;
  schema?: string;
  database?: string;
  rowCount?: number;
  comment?: string;
  isView?: boolean;
};

export type TableSchemaToolSchema = TableSchemaToolTable & {
  columns: TableSchemaToolColumn[];
};

export type ListTablesToolOutput = {
  success: boolean;
  tables?: TableSchemaToolTable[];
  total?: number;
  returned?: number;
  offset?: number;
  limit?: number;
  details?: string;
  error?: string;
};

export type DescribeTableSchemaToolOutput = {
  success: boolean;
  table?: TableSchemaToolSchema;
  details?: string;
  error?: string;
};

export type DefaultTableSchemaTools = {
  list_tables: Tool<ListTablesToolParameters, ListTablesToolOutput>;
  describe_table_schema: Tool<
    DescribeTableSchemaToolParameters,
    DescribeTableSchemaToolOutput
  >;
};

function toToolTable(table: DataTable): TableSchemaToolTable {
  return {
    tableName: getTableNameForAi(table),
    fullTableName: getFullTableNameForAi(table),
    ...(getSchemaNameForAi(table) ? {schema: getSchemaNameForAi(table)} : {}),
    ...(getDatabaseNameForAi(table)
      ? {database: getDatabaseNameForAi(table)}
      : {}),
    ...(table.rowCount !== undefined ? {rowCount: table.rowCount} : {}),
    ...(table.comment ? {comment: table.comment} : {}),
    ...(table.isView ? {isView: table.isView} : {}),
  };
}

function toToolSchema(table: DataTable): TableSchemaToolSchema {
  return {
    ...toToolTable(table),
    columns: table.columns.map((column) => ({
      name: column.name,
      ...(column.type ? {type: column.type} : {}),
    })),
  };
}

function getAvailableTables(
  store: StoreApi<AiSliceState & DuckDbSliceState>,
  params:
    | Pick<ListTablesToolParameters, 'scope' | 'schema' | 'database'>
    | Pick<DescribeTableSchemaToolParameters, 'scope' | 'schema' | 'database'>,
): DataTable[] {
  const dbState = store.getState().db;
  return getTablesForAiScope(dbState.tables, dbState.currentDatabase, params);
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function matchesTableName(table: DataTable, rawTableName: string): boolean {
  const tableName = normalizeName(rawTableName);
  const databaseName = getDatabaseNameForAi(table);
  const schemaName = getSchemaNameForAi(table);
  const bareTableName = getTableNameForAi(table);
  const databaseQualifiedName =
    databaseName && schemaName
      ? `${databaseName}.${schemaName}.${bareTableName}`
      : undefined;
  return (
    normalizeName(bareTableName) === tableName ||
    normalizeName(getFullTableNameForAi(table)) === tableName ||
    (databaseQualifiedName
      ? normalizeName(databaseQualifiedName) === tableName
      : false)
  );
}

function findMatchingTables(
  tables: DataTable[],
  params: DescribeTableSchemaToolParameters,
): DataTable[] {
  return tables.filter((table) => {
    if (!matchesTableName(table, params.tableName)) return false;
    if (params.schema && getSchemaNameForAi(table) !== params.schema) {
      return false;
    }
    if (params.database && getDatabaseNameForAi(table) !== params.database) {
      return false;
    }
    return true;
  });
}

function getTableIdentityForMessage(table: DataTable): string {
  const database = getDatabaseNameForAi(table);
  const schema = getSchemaNameForAi(table);
  const tableName = getTableNameForAi(table);
  return [database, schema, tableName].filter(Boolean).join('.');
}

function tableNamesForError(tables: DataTable[]): string {
  return tables.map(getTableIdentityForMessage).join(', ') || '(none)';
}

export function createTableSchemaTools(
  store: StoreApi<AiSliceState & DuckDbSliceState>,
): DefaultTableSchemaTools {
  return {
    list_tables: tool({
      description: `List available local DuckDB tables in the current database main schema.
Use this to discover table names, row counts, and metadata when the table you need is not shown in the instructions.
By default this searches the current database main schema. Set scope to "current_database" for other schemas in the current database, or "all" plus optional database/schema filters for attached databases.`,
      inputSchema: ListTablesToolParameters,
      execute: async (
        params: ListTablesToolParameters,
      ): Promise<ListTablesToolOutput> => {
        const search = params.search?.trim().toLowerCase();
        const allTables = getAvailableTables(store, params);
        const matchingTables = search
          ? allTables.filter((table) =>
              (
                [
                  getTableNameForAi(table),
                  getFullTableNameForAi(table),
                  getSchemaNameForAi(table),
                  getDatabaseNameForAi(table),
                ].filter(Boolean) as string[]
              ).some((value) => value.toLowerCase().includes(search)),
            )
          : allTables;
        const tables = matchingTables
          .slice(params.offset, params.offset + params.limit)
          .map(toToolTable);

        return {
          success: true,
          tables,
          total: matchingTables.length,
          returned: tables.length,
          offset: params.offset,
          limit: params.limit,
          details: `Returned ${tables.length} of ${matchingTables.length} matching tables in scope "${params.scope}".`,
        } satisfies ListTablesToolOutput;
      },
    }),
    describe_table_schema: tool({
      description: `Describe one available local DuckDB table in the current database main schema.
Call this before writing SQL against a table whose columns are not shown in the instructions.
By default this searches the current database main schema. Set scope to "current_database" for other schemas in the current database, or "all" plus optional database/schema filters for attached databases.`,
      inputSchema: DescribeTableSchemaToolParameters,
      execute: async (
        params: DescribeTableSchemaToolParameters,
      ): Promise<DescribeTableSchemaToolOutput> => {
        const availableTables = getAvailableTables(store, params);
        const matches = findMatchingTables(availableTables, params);

        if (matches.length === 0) {
          return {
            success: false,
            error: `Table "${params.tableName}" was not found in scope "${params.scope}". Available tables in that scope: ${tableNamesForError(
              availableTables.slice(0, 25),
            )}${availableTables.length > 25 ? ', ...' : ''}.`,
          } satisfies DescribeTableSchemaToolOutput;
        }

        if (matches.length > 1) {
          return {
            success: false,
            error: `Table name "${params.tableName}" is ambiguous. Use schema or database to choose one of: ${tableNamesForError(
              matches,
            )}.`,
          } satisfies DescribeTableSchemaToolOutput;
        }

        const table = toToolSchema(matches[0]!);
        return {
          success: true,
          table,
          details: `Found ${table.columns.length} columns for "${table.fullTableName}".`,
        } satisfies DescribeTableSchemaToolOutput;
      },
    }),
  };
}
