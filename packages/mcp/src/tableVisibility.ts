import type {DataTable} from '@sqlrooms/duckdb';

const INTERNAL_SQLROOMS_PREFIX = '__sqlrooms';

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
