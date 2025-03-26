import * as arrow from 'apache-arrow';
import {LoadMethod, LoadOptions, LoadSpatialOptions} from './load/load';

export type LoadFileOptions = {
  method?: LoadMethod;
} & LoadOptions;

export type LoadArrowOptions = Pick<LoadOptions, 'schema'>;

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
   * Execute a SQL query and return the result as an Arrow table
   * @param query SQL query to execute
   */
  query(query: string): Promise<arrow.Table>;

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
   * Load a spatial file into DuckDB using the st_read function
   * @param fileName - Path to the file to load
   * @param tableName - Name of the table to create
   * @param opts - Load options
   */
  loadSpatialFile(
    fileName: string | File,
    tableName: string,
    opts?: LoadSpatialOptions,
  ): Promise<void>;

  /**
   * Load an arrow table or an arrow IPC stream into DuckDB
   * @param table - Arrow table or arrow IPC stream to load
   * @param tableName - Name of the table to create
   */
  loadArrow(
    table: arrow.Table | Uint8Array,
    tableName: string,
    opts?: LoadArrowOptions,
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
    opts?: LoadOptions,
  ): Promise<void>;
}
