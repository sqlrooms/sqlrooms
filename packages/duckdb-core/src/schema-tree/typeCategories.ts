import {DataType} from 'apache-arrow';

import type {TableColumn} from '../types';

export type ColumnTypeCategory =
  | 'number'
  | 'string'
  | 'datetime'
  | 'boolean'
  | 'binary'
  | 'json'
  | 'struct'
  | 'geometry';

export type ColumnTypeLike = string | Pick<TableColumn, 'type'>;

const DUCKDB_TYPE_CATEGORIES = {
  string: [/^varchar/, /^char/, /^text/, /^string/, /^uuid/, /^bit/, /^enum/],
  number: [
    /^tinyint/,
    /^smallint/,
    /^integer/,
    /^bigint/,
    /^hugeint/,
    /^utinyint/,
    /^usmallint/,
    /^uinteger/,
    /^ubigint/,
    /^uhugeint/,
    /^decimal/,
    /^numeric/,
    /^double/,
    /^float/,
    /^real/,
  ],
  boolean: [/^bool(ean)?/],
  binary: [/^blob/, /^bytea/, /^binary/, /^varbinary/],
  datetime: [
    /^date$/,
    /^time$/,
    /^timestamp$/,
    /^timestamp_s$/,
    /^timestamp_ms$/,
    /^timestamp_ns$/,
    /^timestamptz$/,
    /^interval$/,
  ],
  json: [/^json$/],
  struct: [/^struct\b/, /^list\b/, /^map\b/, /^array\b/, /^union\b/, /\[\]$/],
  geometry: [/^geometry/],
} satisfies Record<ColumnTypeCategory, RegExp[]>;

function normalizeDuckDbColumnType(columnType: string): string {
  return columnType.trim().toLowerCase();
}

function isDuckDbBitType(columnType: string): boolean {
  return /^bit(?:\b|\()/.test(normalizeDuckDbColumnType(columnType));
}

/**
 * Get the category of a column type
 * @param columnType - The type of the column
 * @returns The category of the column type
 */
export function getDuckDbTypeCategory(
  columnType: string,
): ColumnTypeCategory | undefined {
  const type = normalizeDuckDbColumnType(columnType);
  if (type.endsWith('[]')) {
    return 'struct';
  }

  for (const [category, patterns] of Object.entries(DUCKDB_TYPE_CATEGORIES)) {
    if (patterns.some((pattern) => type.match(pattern))) {
      return category as ColumnTypeCategory;
    }
  }
  return undefined;
}
/**
 * This function is used to get the type category of a column from an Arrow table.
 *
 * @param type - The Arrow DataType of the column.
 * @returns The type category of the column.
 */
export function getArrowColumnTypeCategory(type: DataType): ColumnTypeCategory {
  const typeName = type.toString().toLowerCase();

  // Note: Arrow doesn't have built-in geometry types, so we'll need to check the type name
  // if your geometry types are custom implementations
  if (typeName.includes('geometry')) {
    return 'geometry';
  }

  if (
    DataType.isInt(type) ||
    DataType.isFloat(type) ||
    DataType.isDecimal(type)
  ) {
    return 'number';
  }

  if (
    DataType.isDate(type) ||
    DataType.isTime(type) ||
    DataType.isTimestamp(type)
  ) {
    return 'datetime';
  }

  if (DataType.isBool(type)) {
    return 'boolean';
  }

  if (DataType.isBinary(type)) {
    return 'binary';
  }

  // Default to string type for all other cases
  return 'string';
}

/** Returns the semantic category for a DuckDB column type string or table column. */
export function getColumnTypeCategory(
  column: ColumnTypeLike,
): ColumnTypeCategory | undefined {
  return getDuckDbTypeCategory(
    typeof column === 'string' ? column : column.type,
  );
}

/** Returns true when a DuckDB column type belongs to the numeric category. */
export function isColumnNumeric(column: ColumnTypeLike): boolean {
  const columnType = typeof column === 'string' ? column : column.type;
  return (
    getColumnTypeCategory(columnType) === 'number' ||
    isDuckDbBitType(columnType)
  );
}

/** Returns true when a DuckDB column type belongs to the temporal category. */
export function isColumnTemporal(column: ColumnTypeLike): boolean {
  return getColumnTypeCategory(column) === 'datetime';
}

/** Returns true when a DuckDB column type is numeric or temporal. */
export function isColumnQuantitative(column: ColumnTypeLike): boolean {
  return (
    isColumnNumeric(column) || getColumnTypeCategory(column) === 'datetime'
  );
}

/** Returns true when a DuckDB column type is useful as a categorical field. */
export function isColumnCategorical(column: ColumnTypeLike): boolean {
  const category = getColumnTypeCategory(column);
  return category === 'string' || category === 'binary';
}

/** Returns true when a DuckDB column type is a geometry type. */
export function isColumnGeometry(column: ColumnTypeLike): boolean {
  return getColumnTypeCategory(column) === 'geometry';
}

/** Maps a semantic category to the narrow DuckDB-ish type selectors already accept. */
export function columnTypeCategoryToSelectorType(
  category: ColumnTypeCategory,
): string {
  switch (category) {
    case 'number':
      return 'DOUBLE';
    case 'string':
      return 'VARCHAR';
    case 'datetime':
      return 'TIMESTAMP';
    case 'boolean':
      return 'BOOLEAN';
    case 'binary':
      return 'BLOB';
    case 'json':
      return 'JSON';
    case 'struct':
      return 'STRUCT';
    case 'geometry':
      return 'GEOMETRY';
  }
}
