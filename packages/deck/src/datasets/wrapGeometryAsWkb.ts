import type * as arrow from 'apache-arrow';

function quoteSqlIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * True for DuckDB's native spatial `GEOMETRY` type (not GeoArrow, not WKB blob).
 *
 * Native GEOMETRY cannot be decoded by deck — it must be projected through
 * `ST_AsWKB(...)` before prepare/render.
 */
export function isDuckDbNativeGeometryType(
  type: string | null | undefined,
): boolean {
  if (!type) return false;
  const normalized = type.toLowerCase();
  return normalized.includes('geometry') && !normalized.includes('geoarrow');
}

/**
 * Builds `DESCRIBE SELECT * FROM (<sql>)` so DuckDB returns logical column types
 * (including `GEOMETRY`) rather than Arrow binary approximations.
 */
export function createDescribeDatasetSql(sql: string): string {
  const cleaned = sql.trim().replace(/(?:\s*;+\s*)+$/, '');
  return `DESCRIBE SELECT * FROM (${cleaned}) AS "__sqlrooms_describe_source"`;
}

/** Column name + DuckDB type from a `DESCRIBE` result table. */
export type DescribedSqlColumn = {
  name: string;
  type: string;
};

/**
 * Parses DuckDB `DESCRIBE` output (`column_name`, `column_type`) into a list of
 * columns. Returns an empty list when the result shape is unexpected.
 */
export function parseDescribeSqlColumns(
  table: arrow.Table,
): DescribedSqlColumn[] {
  const names = table.getChild('column_name') ?? table.getChild('column_names');
  const types = table.getChild('column_type') ?? table.getChild('column_types');
  if (!names || !types) return [];

  const columns: DescribedSqlColumn[] = [];
  for (let i = 0; i < table.numRows; i++) {
    const name = names.get(i);
    const type = types.get(i);
    if (typeof name !== 'string' || !name) continue;
    columns.push({
      name,
      type: typeof type === 'string' ? type : String(type ?? ''),
    });
  }
  return columns;
}

/** Names of columns whose DuckDB type is native `GEOMETRY`. */
export function geometryColumnsNeedingWkbWrap(
  columns: DescribedSqlColumn[],
): string[] {
  return columns
    .filter((column) => isDuckDbNativeGeometryType(column.type))
    .map((column) => column.name);
}

/**
 * Wraps compiled dataset SQL so native `GEOMETRY` columns are projected as WKB
 * without rewriting the authored statement:
 *
 * `SELECT * REPLACE (ST_AsWKB(col) AS col, …) FROM (<sql>) AS "__sqlrooms_as_wkb"`
 *
 * Returns `null` when there is nothing to wrap.
 */
export function wrapSqlGeometryColumnsAsWkb(
  sql: string,
  geometryColumnNames: readonly string[],
): string | null {
  const unique = [
    ...new Set(
      geometryColumnNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
  ];
  if (unique.length === 0) return null;

  const cleaned = sql.trim().replace(/(?:\s*;+\s*)+$/, '');
  const replacements = unique
    .map((name) => {
      const quoted = quoteSqlIdentifier(name);
      return `ST_AsWKB(${quoted}) AS ${quoted}`;
    })
    .join(', ');

  return [
    `SELECT * REPLACE (${replacements})`,
    `FROM (${cleaned}) AS "__sqlrooms_as_wkb"`,
  ].join('\n');
}
