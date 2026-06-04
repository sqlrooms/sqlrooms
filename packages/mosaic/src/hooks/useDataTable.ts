import type {DataTable} from '@sqlrooms/db';
import {useMemo} from 'react';
import {useTablesWithColumns} from './useTablesWithColumns';

/**
 * Returns the full table reference (database.schema.table) as a string,
 * without SQL escaping (for UI display and matching).
 */
function getTableReference(table: DataTable): string {
  return [table.table.database, table.table.schema, table.table.table]
    .filter((part): part is string => Boolean(part))
    .join('.');
}

/**
 * Finds a table by name, checking multiple naming formats.
 */
function findTableByName(
  tables: DataTable[],
  tableName: string | undefined,
): DataTable | undefined {
  if (!tableName) {
    return undefined;
  }

  return tables.find(
    (table) =>
      getTableReference(table) === tableName ||
      table.table.table === tableName ||
      table.tableName === tableName ||
      table.table.toString() === tableName,
  );
}

export function useDataTable(
  tableName: string | undefined,
): DataTable | undefined {
  const tables = useTablesWithColumns();

  return useMemo(() => findTableByName(tables, tableName), [tables, tableName]);
}
