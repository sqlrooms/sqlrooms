// Adapted from https://github.com/uwdata/mosaic/blob/main/packages/sql/src/load/
// BSD 3-Clause License Copyright (c) 2023, UW Interactive Data Lab

import {createTable} from './create';
import {sqlFrom} from './sql-from';

export type LoadMethod =
  | 'read_json'
  | 'read_ndjson'
  | 'read_parquet'
  | 'read_csv'
  | 'st_read'
  | 'auto';

export interface LoadOptions {
  /** Schema to load the table into */
  schema?: string;
  /** Columns to select, defaults to ['*'] */
  select?: string[];
  /** WHERE clause filter condition */
  where?: string;
  /** Whether to create as a view */
  view?: boolean;
  /** Whether to create as a temporary table */
  temp?: boolean;
  /** Whether to replace existing table */
  replace?: boolean;
  /** Additional file-specific options */
  [key: string]: unknown;
}

export interface LoadSpatialOptions extends LoadOptions {
  /** Nested options for st_read open_options parameter */
  options?: string[] | string | Record<string, unknown>;
}

/**
 * Generic function to load data from a file into a DuckDB table
 * @param method - The DuckDB read method to use (e.g., 'read_csv', 'read_json')
 * @param tableName - Name of the table to create
 * @param fileName - Path to the input file
 * @param options - Load options including select, where, view, temp, replace and file-specific options
 * @param defaults - Default options to merge with provided options
 * @returns SQL query string to create the table
 */
export function load(
  method: LoadMethod,
  tableName: string,
  fileName: string,
  options: LoadOptions = {},
  defaults: Record<string, unknown> = {},
): string {
  const {schema, select = ['*'], where, view, temp, replace, ...file} = options;
  const params = parameters({...defaults, ...file});
  const read =
    method === 'auto'
      ? `'${fileName}'${params ? ', ' + params : ''}`
      : `${method}('${fileName}'${params ? ', ' + params : ''})`;
  const filter = where ? ` WHERE ${where}` : '';
  const query = `SELECT ${select.join(', ')} FROM ${read}${filter}`;
  return createTable(schema ? `${schema}.${tableName}` : tableName, query, {
    view,
    temp,
    replace,
  });
}

/**
 * Load data from a CSV file into a DuckDB table
 * @param tableName - Name of the table to create
 * @param fileName - Path to the CSV file
 * @param options - Load options
 * @returns SQL query string to create the table
 */
export function loadCSV(
  tableName: string,
  fileName: string,
  options?: LoadOptions,
): string {
  return load('read_csv', tableName, fileName, options, {
    auto_detect: true,
    sample_size: -1,
  });
}

/**
 * Load data from a JSON file into a DuckDB table
 * @param tableName - Name of the table to create
 * @param fileName - Path to the JSON file
 * @param options - Load options
 * @returns SQL query string to create the table
 */
export function loadJSON(
  tableName: string,
  fileName: string,
  options?: LoadOptions,
): string {
  return load('read_json', tableName, fileName, options, {
    auto_detect: true,
    format: 'auto',
  });
}

/**
 * Load data from a Parquet file into a DuckDB table
 * @param tableName - Name of the table to create
 * @param fileName - Path to the Parquet file
 * @param options - Load options
 * @returns SQL query string to create the table
 */
export function loadParquet(
  tableName: string,
  fileName: string,
  options?: LoadOptions,
): string {
  return load('read_parquet', tableName, fileName, options);
}

/**
 * Load geometry data within a spatial file format.
 * This method requires that the DuckDB spatial extension is loaded.
 * Supports GeoJSON, TopoJSON, and other common spatial formats.
 * For TopoJSON, set the layer option to indicate the feature to extract.
 * @param tableName - Name of the table to create
 * @param fileName - Path to the spatial data file
 * @param options - Load options including spatial-specific options
 * @returns SQL query string to create the table
 */
export function loadSpatial(
  tableName: string,
  fileName: string,
  options: LoadSpatialOptions = {},
): string {
  // nested options map to the open_options argument of st_read
  const {schema, options: opt, ...rest} = options;
  if (opt) {
    // TODO: check correct syntax for open_options
    const open = Array.isArray(opt)
      ? opt.join(', ')
      : typeof opt === 'string'
        ? opt
        : Object.entries(opt)
            .map(([key, value]) => `${key}=${value}`)
            .join(', ');
    Object.assign(rest, {open_options: open.toUpperCase()});
  }
  // TODO: handle box_2d for spatial_filter_box option
  // TODO: handle wkb_blob for spatial_filter option
  return load(
    'st_read',
    schema ? `${schema}.${tableName}` : tableName,
    fileName,
    rest,
  );
}

/**
 * Load JavaScript objects directly into a DuckDB table
 * @param tableName - Name of the table to create
 * @param data - Array of objects to load
 * @param options - Load options
 * @returns SQL query string to create the table
 */
export function loadObjects(
  tableName: string,
  data: Record<string, unknown>[],
  options: LoadOptions = {},
): string {
  const {schema, select = ['*'], ...opt} = options;
  const values = sqlFrom(data);
  const query =
    select.length === 1 && select[0] === '*'
      ? values
      : `SELECT ${select} FROM ${values}`;
  return createTable(schema ? `${schema}.${tableName}` : tableName, query, opt);
}

/**
 * Convert options object to DuckDB parameter string
 * @param options - Object containing parameter key-value pairs
 * @returns Formatted parameter string
 */
function parameters(options: Record<string, unknown>): string {
  return Object.entries(options)
    .map(([key, value]) => `${key}=${toDuckDBValue(value)}`)
    .join(', ');
}

/**
 * Convert JavaScript value to DuckDB literal string representation
 * @param value - Value to convert
 * @returns DuckDB literal string
 */
function toDuckDBValue(value: unknown): string {
  switch (typeof value) {
    case 'boolean':
      return String(value);
    case 'string':
      return `'${value}'`;
    case 'undefined':
    case 'object':
      if (value == null) {
        return 'NULL';
      } else if (Array.isArray(value)) {
        return '[' + value.map((v) => toDuckDBValue(v)).join(', ') + ']';
      } else {
        return (
          '{' +
          Object.entries(value)
            .map(([k, v]) => `'${k}': ${toDuckDBValue(v)}`)
            .join(', ') +
          '}'
        );
      }
    default:
      return String(value);
  }
}
