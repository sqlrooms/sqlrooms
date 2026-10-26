import * as arrow from 'apache-arrow';

/**
 * Converts an Arrow table to a JSON-compatible array of objects
 * @see https://duckdb.org/docs/api/wasm/query.html#arrow-table-to-json
 * @see https://github.com/apache/arrow/issues/37856
 */
export function arrowTableToJson(
  table: arrow.Table,
): Record<string, unknown>[] {
  return table.toArray().map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        return [
          key,
          convertValue(
            value,
            table.schema.fields.find((field) => field.name === key)?.type,
          ),
        ];
      }),
    ),
  );
}

/**
 * Converts an Arrow table value to a JSON-compatible value
 * @param value
 * @returns
 */
function convertValue(value: unknown, type?: arrow.DataType) {
  // Arrow decimal values stringify their integer coefficient, without the scale.
  // Keep exact decimal strings rather than silently changing units or precision.
  if (value != null && arrow.DataType.isDecimal(type)) {
    const coefficient = String(value);
    const negative = coefficient.startsWith('-');
    const digits = (negative ? coefficient.slice(1) : coefficient).padStart(
      type.scale + 1,
      '0',
    );
    const scaled =
      type.scale > 0
        ? `${digits.slice(0, -type.scale)}.${digits.slice(-type.scale)}`
        : digits + '0'.repeat(-type.scale);
    return (negative ? '-' : '') + scaled;
  }
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value;
  }
  if (typeof value === 'bigint') {
    if (value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) {
      return Number(value);
    }
    return String(value);
  }
  if (typeof value === 'number') {
    return value;
  }
  return String(value);
}
