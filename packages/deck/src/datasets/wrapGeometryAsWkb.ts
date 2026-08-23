import type * as arrow from 'apache-arrow';

function quoteSqlIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/** True for DuckDB native `GEOMETRY` / `GEOMETRY('CRS')` (not arrays/structs). */
export function isDuckDbNativeGeometryType(
  type: string | null | undefined,
): boolean {
  if (!type) return false;
  const normalized = type.trim().toLowerCase();
  return normalized === 'geometry' || normalized.startsWith('geometry(');
}

/** `DESCRIBE SELECT * FROM (<sql>)` for logical column types. */
export function createDescribeDatasetSql(sql: string): string {
  const cleaned = sql.trim().replace(/(?:\s*;+\s*)+$/, '');
  return `DESCRIBE SELECT * FROM (${cleaned}) AS "__sqlrooms_describe_source"`;
}

/** Column name + DuckDB type from a `DESCRIBE` result table. */
export type DescribedSqlColumn = {
  name: string;
  type: string;
};

/** Parse DuckDB DESCRIBE rows (`column_name`, `column_type`). */
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

/**
 * Common geometry output names, including the lon/lat inject alias.
 * Matching is case-insensitive.
 */
export const KNOWN_GEOMETRY_COLUMN_NAMES = [
  'geom',
  'geometry',
  '__sqlrooms_geom',
  'wkb_geometry',
  'the_geom',
] as const;

function columnNamesMatch(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function describedColumnNames(
  columns: readonly DescribedSqlColumn[],
): string[] {
  return columns.map((column) => column.name);
}

/** Names of columns whose DuckDB type is native `GEOMETRY`. */
export function geometryColumnsNeedingWkbWrap(
  columns: readonly DescribedSqlColumn[],
): string[] {
  return columns
    .filter((column) => isDuckDbNativeGeometryType(column.type))
    .map((column) => column.name);
}

/**
 * True when DESCRIBE (or an equivalent name/type list) already exposes
 * renderable geometry: a native `GEOMETRY` type, a configured geometry
 * column, or a known geometry output name. CRS parameters on DuckDB
 * `GEOMETRY('EPSG:…')` types are not interpreted here.
 */
export function describedColumnsIncludeGeometry(
  columns: readonly DescribedSqlColumn[],
  geometryColumn?: string,
): boolean {
  if (geometryColumnsNeedingWkbWrap(columns).length > 0) return true;
  const names = describedColumnNames(columns);
  const hasName = (wanted: string) =>
    names.some((name) => columnNamesMatch(name, wanted));
  if (geometryColumn && hasName(geometryColumn)) return true;
  return KNOWN_GEOMETRY_COLUMN_NAMES.some((name) => hasName(name));
}

/**
 * `SELECT * REPLACE (ST_AsWKB(col) AS col, …) FROM (<sql>)` for native GEOMETRY.
 * Returns null when there is nothing to wrap.
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
