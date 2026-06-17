import {
  getAllTablesFromSchemaTrees as getCoreAllTablesFromSchemaTrees,
  resolveTableReference,
  type DataTable,
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
  return getCoreAllTablesFromSchemaTrees(
    Array.isArray(schemaTrees) ? schemaTrees : undefined,
  ) as DataTable[];
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
