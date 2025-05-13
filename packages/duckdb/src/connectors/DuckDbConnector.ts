import {LoadFileOptions, StandardLoadOptions} from '@sqlrooms/project-config';
import * as arrow from 'apache-arrow';
import {TypeMap} from 'apache-arrow';

export interface DuckDbConnector {
  /**
   * Initialize the connector
   */
  initialize(): Promise<void>;

  /**
   * Destroy the connector and clean up resources
   */
  destroy(): Promise<void>;

  /**
   * Execute a SQL query without returning a result
   * @param sql SQL query to execute
   */
  execute(sql: string): Promise<void>;

  /**
   * Execute a SQL query and return the result as an Arrow table
   * @param query SQL query to execute
   */
  query<T extends TypeMap = any>(query: string): Promise<arrow.Table<T>>;

  /**
   * Execute a SQL query and return the result as a JSON object
   * @param query
   */
  queryJson<T = Record<string, any>>(query: string): Promise<Iterable<T>>;

  /**
   * Load a file into DuckDB and create a table
   * @param fileName - Path to the file to load
   * @param tableName - Name of the table to create
   * @param opts - Load options
   */
  loadFile(
    fileName: string | File,
    tableName: string,
    opts?: LoadFileOptions,
  ): Promise<void>;

  /**
   * Load an arrow table or an arrow IPC stream into DuckDB
   * @param table - Arrow table or arrow IPC stream to load
   * @param tableName - Name of the table to create
   */
  loadArrow(
    table: arrow.Table | Uint8Array,
    tableName: string,
    opts?: {schema?: string},
  ): Promise<void>;

  /**
   * Load JavaScript objects into DuckDB
   * @param data - Array of objects to load
   * @param tableName - Name of the table to create
   * @param opts - Load options
   */
  loadObjects(
    data: Record<string, unknown>[],
    tableName: string,
    opts?: StandardLoadOptions,
  ): Promise<void>;
}
