import {
  parseQualifiedSqlIdentifier,
  type DataTable,
  type QualifiedTableName,
} from '@sqlrooms/duckdb-core';

export type TableIdentitySummary = {
  /**
   * Fully quoted SQL identifier from QualifiedTableName.toString(), used at
   * string-only tool boundaries.
   */
  tableId: string;
  /**
   * @deprecated Use tableId for string-only tools.
   */
  qualifiedName: string;
  database?: string;
  schema?: string;
  tableName: string;
  isView: boolean;
  columnCount: number;
  rowCount?: number;
};

export function getCanonicalTableId(table: DataTable): string {
  return table.table.toString();
}

export function getAllTablesFromSchemaTrees(schemaTrees: unknown): DataTable[] {
  const tables: DataTable[] = [];
  if (!Array.isArray(schemaTrees)) return tables;

  for (const dbNode of schemaTrees) {
    for (const schemaNode of dbNode?.children ?? []) {
      for (const tableNode of schemaNode?.children ?? []) {
        if (
          tableNode?.object?.type === 'table' ||
          tableNode?.object?.type === 'view'
        ) {
          tables.push(tableNode.object as DataTable);
        }
      }
    }
  }
  return tables;
}

export function createTableIdentitySummary(
  table: DataTable,
): TableIdentitySummary {
  const tableId = getCanonicalTableId(table);
  return {
    tableId,
    qualifiedName: tableId,
    database: table.table.database,
    schema: table.table.schema,
    tableName: table.table.table,
    isView: table.isView,
    columnCount: table.columns.length,
    rowCount: table.rowCount,
  };
}

function matchesQualifiedTableName(
  table: DataTable,
  tableName: Partial<QualifiedTableName>,
): boolean {
  return (
    table.table.table === tableName.table &&
    (!tableName.schema || table.table.schema === tableName.schema) &&
    (!tableName.database || table.table.database === tableName.database)
  );
}

export function resolveTableFromCatalog(
  tables: DataTable[],
  tableId: string,
): {table?: DataTable; ambiguousMatches?: DataTable[]} {
  const trimmedTableId = tableId.trim();

  const canonicalMatches = tables.filter(
    (table) => getCanonicalTableId(table) === trimmedTableId,
  );
  if (canonicalMatches.length === 1) return {table: canonicalMatches[0]};
  if (canonicalMatches.length > 1) {
    return {ambiguousMatches: canonicalMatches};
  }

  const parsedTableId = parseQualifiedSqlIdentifier(trimmedTableId);
  if (
    parsedTableId?.table &&
    (parsedTableId.schema || parsedTableId.database)
  ) {
    const qualifiedMatches = tables.filter((table) =>
      matchesQualifiedTableName(table, parsedTableId),
    );
    if (qualifiedMatches.length === 1) return {table: qualifiedMatches[0]};
    if (qualifiedMatches.length > 1) {
      return {ambiguousMatches: qualifiedMatches};
    }
  }

  const bareMatches = tables.filter(
    (table) => table.table.table === trimmedTableId,
  );
  if (bareMatches.length === 1) return {table: bareMatches[0]};
  if (bareMatches.length > 1) return {ambiguousMatches: bareMatches};

  return {};
}

export function formatAmbiguousTableMessage(
  tableId: string,
  tables: DataTable[],
) {
  return `Table "${tableId}" is ambiguous. Matching tableIds: ${tables
    .map(getCanonicalTableId)
    .join(', ')}.`;
}
