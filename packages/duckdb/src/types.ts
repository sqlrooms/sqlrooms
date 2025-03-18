import * as arrow from 'apache-arrow';

export interface TableColumn {
  name: string;
  type: string;
}

export interface DataTable {
  tableName: string;
  columns: TableColumn[];
  rowCount?: number;
}

export interface DuckQueryExecutionResult {
  arrowTable: arrow.Table;
  rowCount: number;
}

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
   * Load a file into DuckDB and create a view
   * @param file File object or path/URL string
   * @param tableName Name of the table to create
   */
  loadFile(
    file: string | File,
    tableName: string,
  ): Promise<DuckQueryExecutionResult>;

  /**
   * Drop a file from DuckDB
   * @param fileName Name of the file to drop
   */
  dropFile(fileName: string): Promise<void>;

  /**
   * Check if a table exists in the database
   * @param tableName Table name to check
   * @param schema Schema name
   */
  tableExists(tableName: string, schema?: string): Promise<boolean>;

  /**
   * Get a list of all tables in the database
   * @param schema Schema name
   */
  getTables(schema?: string): Promise<string[]>;

  /**
   * Get schema information for a specific table
   * @param tableName Table name
   * @param schema Schema name
   */
  getTableSchema(tableName: string, schema?: string): Promise<DataTable>;

  /**
   * Get schema information for all tables
   * @param schema Schema name
   */
  getTableSchemas(schema?: string): Promise<DataTable[]>;

  /**
   * Drop a table from the database
   * @param tableName Table name
   */
  dropTable(tableName: string): Promise<void>;
}
