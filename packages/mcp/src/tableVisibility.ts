import type {DataTable} from '@sqlrooms/duckdb';

const INTERNAL_SQLROOMS_PREFIX = '__sqlrooms';

/**
 * Returns whether an identifier belongs to SQLRooms' internal table namespace.
 * Matching is case-insensitive and includes both the reserved `__sqlrooms`
 * prefix and the connector-specific metadata namespace.
 */
export function isInternalTableIdentifier(
  identifier: unknown,
  metaNamespace: string,
): boolean {
  if (typeof identifier !== 'string') return false;
  const normalizedIdentifier = identifier.toLowerCase();
  return (
    normalizedIdentifier.startsWith(INTERNAL_SQLROOMS_PREFIX) ||
    normalizedIdentifier === metaNamespace.toLowerCase()
  );
}

/**
 * Removes tables whose database, schema, or table identifier is internal.
 * The supplied metadata namespace is compared case-insensitively at every
 * identifier level.
 */
export function filterVisibleTables(
  tables: DataTable[],
  metaNamespace: string,
): DataTable[] {
  return tables.filter((table) => {
    const {database, schema, table: tableName} = table.table;
    return ![database, schema, tableName].some((identifier) =>
      isInternalTableIdentifier(identifier, metaNamespace),
    );
  });
}
