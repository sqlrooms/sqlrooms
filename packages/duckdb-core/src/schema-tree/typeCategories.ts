import {DataType} from 'apache-arrow';

export type ColumnTypeCategory =
  | 'number'
  | 'string'
  | 'datetime'
  | 'boolean'
  | 'binary'
  | 'json'
  | 'struct'
  | 'geometry';

const DUCKDB_TYPE_CATEGORIES = {
  string: [/^varchar/, /^char/, /^text/, /^string/, /^uuid/, /^bit/],
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
  ],
  boolean: [/^bool(ean)?/],
  binary: [/^blob/, /^bytea/, /^binary/, /^varbinary/],
  datetime: [/^date$/, /^time$/, /^timestamp$/, /^timestamptz$/, /^interval$/],
  json: [/^json$/],
  struct: [/^struct$/, /^list$/, /^map$/, /^array$/, /^union$/],
  geometry: [/^geometry/],
} satisfies Record<ColumnTypeCategory, RegExp[]>;

/**
 * Get the category of a column type
 * @param columnType - The type of the column
 * @returns The category of the column type
 */
export function getDuckDbTypeCategory(
  columnType: string,
): ColumnTypeCategory | undefined {
  const type = columnType.toLowerCase();
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

  // Note: Arrow doesn't have built-in geometry types, so we'll need to check the type name
  // if your geometry types are custom implementations
  if (type.toString().toLowerCase().includes('geometry')) {
    return 'geometry';
  }

  // Default to string type for all other cases
  return 'string';
}
