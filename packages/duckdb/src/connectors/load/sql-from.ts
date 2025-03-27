// Adapted from https://github.com/uwdata/mosaic/blob/main/packages/sql/src/load/
// BSD 3-Clause License Copyright (c) 2023, UW Interactive Data Lab

/**
 * Create a SQL query that embeds the given data for loading.
 * @param {*} data The dataset as an array of objects.
 * @param {object} [options] Loading options.
 * @param {string[]|Record<string,string>} [options.columns] The columns to include.
 *   If not specified, the keys of the first data object are used.
 * @returns {string} SQL query string to load data.
 */
export function sqlFrom(
  data: Record<string, unknown>[],
  {
    columns = Object.keys(data?.[0] || {}),
  }: {columns?: string[] | Record<string, string>} = {},
) {
  let keys: string[] = [];
  let columnMap: Record<string, string>;
  if (Array.isArray(columns)) {
    keys = columns;
    columnMap = keys.reduce((m, k) => ({...m, [k]: k}), {});
  } else {
    columnMap = columns;
    keys = Object.keys(columns);
  }
  if (!keys.length) {
    throw new Error('Can not create table from empty column set.');
  }
  const subq = [];
  for (const datum of data) {
    const sel = keys.map(
      (k) => `${literalToSQL(datum[k])} AS "${columnMap[k]}"`,
    );
    subq.push(`(SELECT ${sel.join(', ')})`);
  }
  return subq.join(' UNION ALL ');
}

/**
 * Convert a value to a SQL literal.
 * @param {*} value The value to convert.
 * @returns {string} The SQL literal.
 */
export function literalToSQL(value: unknown) {
  switch (typeof value) {
    case 'number':
      return Number.isFinite(value) ? `${value}` : 'NULL';
    case 'string':
      return `'${value.replace(`'`, `''`)}'`;
    case 'boolean':
      return value ? 'TRUE' : 'FALSE';
    default:
      if (value == null) {
        return 'NULL';
      } else if (value instanceof Date) {
        const ts = +value;
        if (Number.isNaN(ts)) return 'NULL';
        const y = value.getUTCFullYear();
        const m = value.getUTCMonth();
        const d = value.getUTCDate();
        return ts === Date.UTC(y, m, d)
          ? `DATE '${y}-${m + 1}-${d}'` // utc date
          : `epoch_ms(${ts})`; // timestamp
      } else if (value instanceof RegExp) {
        return `'${value.source}'`;
      } else {
        // otherwise rely on string coercion
        return `${value}`;
      }
  }
}
