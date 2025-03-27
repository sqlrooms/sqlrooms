import * as arrow from 'apache-arrow';

/**
 * Escapes a value for use in DuckDB SQL queries by wrapping it in single quotes
 * and escaping any existing single quotes by doubling them.
 *
 * @param val - The value to escape. Will be converted to string if not already a string.
 * @returns The escaped string value wrapped in single quotes.
 * @example
 * escapeVal("John's data") // Returns "'John''s data'"
 */
export const escapeVal = (val: unknown) => {
  return `'${String(val).replace(/'/g, "''")}'`;
};

/**
 * Escapes an identifier (like table or column names) for use in DuckDB SQL queries
 * by wrapping it in double quotes and escaping any existing double quotes by doubling them.
 * If the identifier is already properly quoted, returns it as is.
 *
 * @param id - The identifier string to escape
 * @returns The escaped identifier wrapped in double quotes
 * @example
 * escapeId("my_table") // Returns '"my_table"'
 * escapeId("my""table") // Returns '"my""""table"'
 */
export const escapeId = (id: string) => {
  const str = String(id);
  if (str.startsWith('"') && str.endsWith('"')) {
    return str;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

/**
 * Checks if a DuckDB type string represents a numeric type.
 * Includes INTEGER, DECIMAL, FLOAT, REAL, and DOUBLE types.
 *
 * @param type - The DuckDB type string to check
 * @returns True if the type is numeric, false otherwise
 * @example
 * isNumericDuckType('INTEGER') // Returns true
 * isNumericDuckType('VARCHAR') // Returns false
 */
export const isNumericDuckType = (type: string) =>
  type.indexOf('INT') >= 0 ||
  type.indexOf('DECIMAL') >= 0 ||
  type.indexOf('FLOAT') >= 0 ||
  type.indexOf('REAL') >= 0 ||
  type.indexOf('DOUBLE') >= 0;

/**
 * Extracts a numeric value from an Arrow Table at the specified column and row index.
 * Handles both column name and index-based access. Converts BigInt values to numbers.
 *
 * @param res - The Arrow Table containing the data
 * @param column - The column name or index (0-based) to read from. Defaults to first column (0)
 * @param index - The row index (0-based) to read from. Defaults to first row (0)
 * @returns The numeric value at the specified position, or NaN if the value is null/undefined
 * @example
 * const value = getColValAsNumber(table, "amount", 0)
 */
export function getColValAsNumber(
  res: arrow.Table,
  column: string | number = 0,
  index = 0,
): number {
  const v = (
    typeof column === 'number' ? res.getChildAt(column) : res.getChild(column)
  )?.get(index);
  if (v === undefined || v === null) {
    return NaN;
  }
  // if it's an array (can be returned by duckdb as bigint)
  return Number(v[0] ?? v);
}
