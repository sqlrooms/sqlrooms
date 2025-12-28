// Adapted from https://github.com/uwdata/mosaic/blob/main/packages/sql/src/load/
// BSD 3-Clause License Copyright (c) 2023, UW Interactive Data Lab

interface TableOptions {
  /** Whether to replace existing table/view if it exists */
  replace?: boolean;
  /** Whether to create a temporary table/view */
  temp?: boolean;
  /** Whether to create a view instead of a table */
  view?: boolean;
}

interface SchemaOptions {
  /** Whether to enforce strict schema creation (no IF NOT EXISTS) */
  strict?: boolean;
}

/**
 * Creates a SQL query string to create a new table or view in DuckDB
 * @param name - Name of the table or view to create
 * @param query - SQL query whose results will populate the table/view
 * @param options - Options for table/view creation
 * @param options.replace - Whether to replace existing table/view if it exists (default: false)
 * @param options.temp - Whether to create a temporary table/view (default: false)
 * @param options.view - Whether to create a view instead of a table (default: false)
 * @returns SQL query string to create the table/view
 */
export function createTable(
  name: string,
  query: string,
  {replace = false, temp = false, view = false}: TableOptions = {},
): string {
  return (
    'CREATE' +
    (replace ? ' OR REPLACE ' : ' ') +
    (temp ? 'TEMP ' : '') +
    (view ? 'VIEW' : 'TABLE') +
    (replace ? ' ' : ' IF NOT EXISTS ') +
    name +
    ' AS ' +
    query
  );
}

/**
 * Creates a SQL query string to create a new schema in DuckDB
 * @param name - Name of the schema to create
 * @param options - Options for schema creation
 * @param options.strict - Whether to enforce strict schema creation (no IF NOT EXISTS) (default: false)
 * @returns SQL query string to create the schema
 */
export function createSchema(
  name: string,
  {strict = false}: SchemaOptions = {},
): string {
  return 'CREATE SCHEMA ' + (strict ? '' : 'IF NOT EXISTS ') + name;
}
