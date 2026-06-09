import type {DataTable} from '@sqlrooms/duckdb-core';

/**
 * Helpers for choosing stable Kepler dataset ids for DuckDB-backed tables.
 *
 * Kepler saves layer config by dataset id, while FSQ Spatial reloads the actual
 * data from DuckDB tables later. These helpers keep the id policy consistent
 * between UI layer creation and project restore.
 */

export type KeplerTableLayerOption = {
  label: string;
  value: string;
};

export type KeplerTableIdentityContext = {
  currentDatabase?: string;
  currentSchema?: string;
};

function isCurrentTable(table: DataTable, context: KeplerTableIdentityContext) {
  if (!context.currentDatabase || !context.currentSchema) {
    return false;
  }

  return (
    table.table.database === context.currentDatabase &&
    table.table.schema === context.currentSchema
  );
}

/**
 * Choose the dataset id that should be written into new Kepler layer config.
 *
 * For the ordinary case, a table in DuckDB's current database/schema uses a
 * bare id (`places`). Attached databases and non-current schemas use qualified
 * SQL references so map config can distinguish them.
 */
export function getKeplerDatasetIdForTable(
  table: DataTable,
  context: KeplerTableIdentityContext,
) {
  if (isCurrentTable(table, context)) {
    // Current-schema table ids are intentionally bare for the common case.
    return table.table.table;
  }

  return table.table.toString();
}

/**
 * Build a human-facing table label from raw catalog parts.
 *
 * Labels omit the current database/schema and do not include SQL identifier
 * quotes. They are display-only; option values still carry the stable dataset id.
 */
export function getKeplerTableLabel(
  table: DataTable,
  context: KeplerTableIdentityContext,
) {
  const labelParts: string[] = [];

  if (
    table.table.database &&
    table.table.database !== context.currentDatabase
  ) {
    labelParts.push(table.table.database);
  }

  if (table.table.schema && table.table.schema !== context.currentSchema) {
    labelParts.push(table.table.schema);
  }

  labelParts.push(table.table.table);
  return labelParts.join('.');
}

/**
 * Resolve a saved Kepler dataset id back to the DuckDB table it should load.
 *
 * Current-schema tables intentionally use bare ids. Tables outside the current
 * database/schema use qualified references, so restore accepts both forms.
 */
export function findKeplerTableForDataId(
  tables: DataTable[],
  dataId: string,
  context: KeplerTableIdentityContext,
) {
  for (const table of tables) {
    if (table.table.toString() === dataId) {
      return table;
    }

    // Current-schema tables are saved by bare name, so restore accepts it.
    if (isCurrentTable(table, context) && table.table.table === dataId) {
      return table;
    }
  }
  return undefined;
}

/**
 * Build the Add Layer dropdown options from known DuckDB tables plus datasets
 * that are already loaded into Kepler.
 *
 * The option value is the dataset id passed to `addTableToMap`; the label is
 * what the user sees. Already-loaded dataset ids are included so users can add
 * additional layers from datasets that may not have a visible DuckDB table row.
 */
export function buildKeplerTableLayerOptions(
  dbTables: DataTable[],
  keplerDatasetIds: string[],
  context: KeplerTableIdentityContext,
): KeplerTableLayerOption[] {
  const optionsByValue = new Map<string, string>();

  for (const table of dbTables) {
    if (table.table.schema !== context.currentSchema) continue;

    const value = getKeplerDatasetIdForTable(table, context);
    const label = getKeplerTableLabel(table, context);

    optionsByValue.set(value, label);
  }

  for (const id of keplerDatasetIds) {
    if (!optionsByValue.has(id)) {
      optionsByValue.set(id, id);
    }
  }

  return Array.from(optionsByValue, ([value, label]) => ({
    label,
    value,
  })).sort(
    (left, right) =>
      left.label.localeCompare(right.label) ||
      left.value.localeCompare(right.value),
  );
}
