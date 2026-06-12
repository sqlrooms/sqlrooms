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

/**
 * Finds a table by name, checking multiple naming formats.
 * Returns undefined if table is not found or tableName is undefined.
 *
 * @param tables List of available tables
 * @param tableName Name of the table to find (optional)
 * @returns The found table or undefined
 */
export function findTableByName(
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

/**
 * Finds a table by name, checking multiple naming formats.
 * Throws an error if the table is not found.
 *
 * @param tables List of available tables
 * @param tableName Name of the table to find (required)
 * @returns The found table
 * @throws Error if table is not found
 */
export function findTableByNameOrThrow(
  tables: DataTable[],
  tableName: string,
): DataTable {
  const table = findTableByName(tables, tableName);

  if (!table) {
    const availableNames = tables.map((t) => t.tableName).join(', ');
    throw new Error(
      `Table "${tableName}" not found. Available tables: ${availableNames || '(none)'}`,
    );
  }

  return table;
}
