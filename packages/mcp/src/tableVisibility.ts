import type {DataTable} from '@sqlrooms/duckdb';

const INTERNAL_SQLROOMS_PREFIX = '__sqlrooms';

export function filterVisibleTables(
  tables: DataTable[],
  metaNamespace: string,
): DataTable[] {
  const normalizedMetaNamespace = metaNamespace.toLowerCase();
  return tables.filter((table) => {
    const {database, schema, table: tableName} = table.table;
    const identifiers = [database, schema, tableName].map((identifier) =>
      identifier?.toLowerCase(),
    );
    return (
      !identifiers.some((identifier) =>
        identifier?.startsWith(INTERNAL_SQLROOMS_PREFIX),
      ) &&
      database?.toLowerCase() !== normalizedMetaNamespace &&
      schema?.toLowerCase() !== normalizedMetaNamespace
    );
  });
}
