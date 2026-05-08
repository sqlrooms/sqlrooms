/**
 * Column type constants for chart field type filtering
 */

export const NUMERIC_COLUMN_TYPES = [
  'BIGINT',
  'BIT',
  'DECIMAL',
  'DOUBLE',
  'FLOAT',
  'HUGEINT',
  'INTEGER',
  'REAL',
  'SMALLINT',
  'TINYINT',
  'UBIGINT',
  'UHUGEINT',
  'UINTEGER',
  'USMALLINT',
  'UTINYINT',
];

export const TEMPORAL_COLUMN_TYPES = [
  'DATE',
  'TIME',
  'TIMESTAMP',
  'TIMESTAMP_MS',
  'TIMESTAMP_NS',
  'TIMESTAMP_S',
  'TIMESTAMPTZ',
];

export const QUANTITATIVE_COLUMN_TYPES = [
  ...NUMERIC_COLUMN_TYPES,
  ...TEMPORAL_COLUMN_TYPES,
];

export function isTemporalType(
  columnType: string,
): columnType is (typeof TEMPORAL_COLUMN_TYPES)[number] {
  return TEMPORAL_COLUMN_TYPES.includes(columnType);
}

export function isQuantitativeType(
  columnType: string,
): columnType is (typeof QUANTITATIVE_COLUMN_TYPES)[number] {
  return QUANTITATIVE_COLUMN_TYPES.includes(columnType);
}

export function isNumericType(
  columnType: string,
): columnType is (typeof NUMERIC_COLUMN_TYPES)[number] {
  return NUMERIC_COLUMN_TYPES.includes(columnType);
}
