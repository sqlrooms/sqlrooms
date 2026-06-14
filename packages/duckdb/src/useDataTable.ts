import type {DataTable, QualifiedTableName} from '@sqlrooms/duckdb-core';
import {useStoreWithDuckDb} from './DuckDbSlice';

export type UseDataTableOptions = {
  requireColumns?: boolean;
};

export function useDataTable(
  tableName: string | QualifiedTableName | undefined,
  options?: UseDataTableOptions,
): DataTable | undefined {
  const requireColumns = options?.requireColumns ?? false;

  return useStoreWithDuckDb((state) => {
    if (!tableName) {
      return undefined;
    }
    const table = state.db.findTableByName(tableName);
    if (requireColumns && !table?.columns.length) {
      return undefined;
    }
    return table;
  });
}
