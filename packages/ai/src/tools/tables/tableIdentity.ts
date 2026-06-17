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
  database?: string;
  schema?: string;
  tableName: string;
  isView: boolean;
  columnCount: number;
  rowCount?: number;
};

/**
 * Returns the canonical string identity for a visible table.
 *
 * @param table - DataTable to identify.
 * @returns Fully quoted table id from the table's QualifiedTableName.
 */
export function getCanonicalTableId(table: DataTable): string {
  return table.table.toString();
}

/**
 * Extracts table and view objects from SQLRooms schema tree nodes.
 *
 * @param schemaTrees - Unknown schema tree value, usually state.db.schemaTrees.
 * @returns DataTable entries found under database/schema/table tree nodes.
 */
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

/**
 * Builds the compact table identity payload returned by table discovery tools.
 *
 * @param table - DataTable to summarize for model-facing tool output.
 * @returns TableIdentitySummary with canonical tableId and display metadata.
 */
export function createTableIdentitySummary(
  table: DataTable,
): TableIdentitySummary {
  const tableId = getCanonicalTableId(table);
  return {
    tableId,
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

/**
 * Resolves user or tool table input against a visible table catalog.
 *
 * Resolution prefers exact canonical table ids, then qualified SQL identifiers,
 * then unique bare table names. Ambiguous bare names are reported instead of
 * silently selecting one table.
 *
 * @param tables - DataTable catalog to search.
 * @param tableId - Table input from a tool call or model context.
 * @returns Matching table, ambiguous matches, or an empty result when not found.
 */
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

/**
 * Formats a human-readable error for ambiguous table input.
 *
 * @param tableId - Original table input that matched multiple tables.
 * @param tables - DataTable matches that should be shown as canonical options.
 * @returns Error message listing the matching canonical table ids.
 */
export function formatAmbiguousTableMessage(
  tableId: string,
  tables: DataTable[],
) {
  return `Table "${tableId}" is ambiguous. Matching tableIds: ${tables
    .map(getCanonicalTableId)
    .join(', ')}.`;
}
