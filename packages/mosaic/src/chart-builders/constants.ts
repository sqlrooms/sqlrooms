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
