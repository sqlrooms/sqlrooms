import type {DataTable} from '@sqlrooms/db';

/**
 * Returns the full table reference (database.schema.table) as a string,
 * without SQL escaping (for UI display and matching).
 */
export function getTableReference(table: DataTable): string {
  return [table.table.database, table.table.schema, table.table.table]
    .filter((part): part is string => Boolean(part))
    .join('.');
}
