import type {DataTable, QualifiedTableName} from '@sqlrooms/db';

/**
 * Database-specific AI adapter interface.
 * Provides access to tables and database queries for AI tools.
 */
export type DatabaseAiAdapter = {
  /** Get all available tables */
  getTables: () => DataTable[];

  /** Find table by name, returns undefined if not found */
  findTable(tableName: string | QualifiedTableName): DataTable | undefined;

  /** Runs a SQL query and returns the first result table, when the host can. */
  executeSql?: (sql: string) => Promise<{
    numRows: number;
    getChild(name: string): {get(index: number): unknown} | null;
  } | null>;
};
