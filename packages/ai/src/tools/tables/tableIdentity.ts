import {
  getTableDisplayName,
  getTableIdentity,
  resolveTableReference,
  type DataTable,
} from '@sqlrooms/duckdb-core';

/**
 * Compact, model-facing description of a table or view in the AI table catalog.
 *
 * Used by `list_tables` and schema context summaries to expose enough identity
 * and metadata for an agent to choose a table, while keeping the canonical
 * string boundary value in `tableId`.
 */
export type TableIdentitySummary = {
  /**
   * Canonical quoted SQLRooms table reference from
   * QualifiedTableName.toString(), used at string-only tool boundaries.
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
 * @returns Canonical quoted table id from the table's QualifiedTableName.
 */
export function getCanonicalTableId(table: DataTable): string {
  return getTableIdentity(table.table);
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
    tableName: getTableDisplayName(table.table),
    isView: table.isView,
    columnCount: table.columns.length,
    rowCount: table.rowCount,
  };
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
  return resolveTableReference(tables, tableId);
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
