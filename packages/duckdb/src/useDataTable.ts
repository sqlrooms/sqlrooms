import type {DataTable, QualifiedTableName} from '@sqlrooms/duckdb-core';
import {useStoreWithDuckDb} from './DuckDbSlice';

/**
 * Resolves a table reference against the DuckDB table schema cache.
 *
 * String inputs are delegated to `db.findTableByName`, which parses qualified
 * SQL identifiers such as `main.events` and
 * `"memory"."main"."events.2026"`. Unqualified names resolve in the current
 * schema/database from the last schema refresh.
 *
 * @param tableName - A bare, qualified, or structured table reference.
 * @returns The matching data table, including its loaded columns, or undefined.
 */
export function useDataTable(
  tableName: string | QualifiedTableName | undefined,
): DataTable | undefined {
  return useStoreWithDuckDb((state) => {
    if (!tableName) {
      return undefined;
    }
    return state.db.findTableByName(tableName);
  });
}
