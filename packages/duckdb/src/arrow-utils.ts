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
        return [key, convertValue(value)];
      }),
    ),
  );
}

function convertValue(value: unknown) {
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
