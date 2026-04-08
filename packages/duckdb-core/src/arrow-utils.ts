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

/**
 * Converts an Arrow table value to a JSON-compatible value.
 *
 * Arrow Decimal types (common from DuckDB AVG, division, CASE expressions)
 * stringify to numeric-looking strings like "5.2". Without parsing them back
 * to numbers, Vega-Lite quantitative encodings silently drop the rows,
 * producing empty charts.
 */
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
  if (value == null) {
    return null;
  }
  const str = String(value);
  const num = Number(str);
  if (!isNaN(num) && str.trim() !== '') {
    return num;
  }
  return str;
}
