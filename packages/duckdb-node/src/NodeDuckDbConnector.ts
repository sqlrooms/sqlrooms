import {DuckDBConnection, DuckDBInstance} from '@duckdb/node-api';
import {
  BaseDuckDbConnectorImpl,
  createBaseDuckDbConnector,
  DuckDbConnector,
} from '@sqlrooms/duckdb-core';
import {LoadFileOptions, StandardLoadOptions} from '@sqlrooms/room-config';
import * as arrow from 'apache-arrow';
import {
  arrowTableToRows,
  buildQualifiedName,
  objectsToCreateTableSql,
  queryToArrowTable,
} from './helpers';

/**
 * Options for the Node.js DuckDB connector.
 */
export interface NodeDuckDbConnectorOptions {
  /**
   * Path to the database file, or ':memory:' for in-memory database.
   * @default ':memory:'
   */
  dbPath?: string;

  /**
   * SQL to run after initialization.
   */
  initializationQuery?: string;

  /**
   * Configuration options passed to DuckDB instance.
   */
  config?: Record<string, string>;
}

/**
 * Extended DuckDB connector for Node.js environments.
 * Includes access to the underlying DuckDB instance and connection.
 */
export interface NodeDuckDbConnector extends DuckDbConnector {
  /** Get the underlying DuckDB instance */
  getInstance(): DuckDBInstance;
  /** Get the underlying DuckDB connection */
  getConnection(): DuckDBConnection;
}

// ============================================================================
// Connector Factory
// ============================================================================

/**
 * Creates a DuckDB connector for Node.js environments using @duckdb/node-api.
 *
 * @param options - Configuration options for the connector
 * @returns A NodeDuckDbConnector instance
 *
 * @example
 * ```typescript
 * const connector = createNodeDuckDbConnector({
 *   dbPath: ':memory:',
 *   initializationQuery: 'INSTALL json; LOAD json;'
 * });
 *
 * await connector.initialize();
 * const result = await connector.query('SELECT 1 as value');
 * console.log(result.numRows); // 1
 * ```
 */
export function createNodeDuckDbConnector(
  options: NodeDuckDbConnectorOptions = {},
): NodeDuckDbConnector {
  const {dbPath = ':memory:', initializationQuery = '', config = {}} = options;

  let instance: DuckDBInstance | null = null;
  let connection: DuckDBConnection | null = null;

  const ensureConnection = (): DuckDBConnection => {
    if (!connection) {
      throw new Error('DuckDB not initialized');
    }
    return connection;
  };

  const impl: BaseDuckDbConnectorImpl = {
    async initializeInternal() {
      instance = await DuckDBInstance.create(dbPath, config);
      connection = await instance.connect();
    },

    async destroyInternal() {
      if (connection) {
        try {
          connection.closeSync();
        } catch (error) {
          // Connection might already be closed, ignore errors
          console.warn('Error closing connection:', error);
        }
        connection = null;
      }
      instance = null;
      // Give native module time to clean up resources
      await new Promise((resolve) => setTimeout(resolve, 0));
    },

    async executeQueryInternal<T extends arrow.TypeMap = any>(
      sql: string,
      signal: AbortSignal,
    ): Promise<arrow.Table<T>> {
      if (signal.aborted) {
        throw new DOMException('Query was cancelled', 'AbortError');
      }
      return queryToArrowTable<T>(ensureConnection(), sql);
    },

    async loadArrowInternal(
      table: arrow.Table | Uint8Array,
      tableName: string,
      opts?: {schema?: string},
    ): Promise<void> {
      if (table instanceof arrow.Table) {
        const rows = arrowTableToRows(table);
        await impl.loadObjectsInternal!(rows, tableName, {
          schema: opts?.schema,
          replace: true,
        });
      } else {
        throw new Error(
          'Loading Arrow IPC streams is not yet supported in Node connector',
        );
      }
    },

    async loadObjectsInternal(
      data: Record<string, unknown>[],
      tableName: string,
      opts?: StandardLoadOptions,
    ): Promise<void> {
      if (data.length === 0) {
        throw new Error('Cannot load empty data array');
      }

      const qualifiedName = buildQualifiedName(tableName, opts?.schema);
      const sql = objectsToCreateTableSql(data, qualifiedName);
      await ensureConnection().run(sql);
    },

    async loadFileInternal(
      fileName: string | File,
      tableName: string,
      opts?: LoadFileOptions,
    ): Promise<void> {
      if (fileName instanceof File) {
        throw new Error('File objects are not supported in Node connector');
      }

      const qualifiedName = buildQualifiedName(tableName, opts?.schema);
      const method = opts?.method ?? 'auto';

      const sql =
        method === 'auto'
          ? `CREATE OR REPLACE TABLE ${qualifiedName} AS SELECT * FROM '${fileName}'`
          : `CREATE OR REPLACE TABLE ${qualifiedName} AS SELECT * FROM ${method}('${fileName}')`;

      await ensureConnection().run(sql);
    },
  };

  const baseConnector = createBaseDuckDbConnector(
    {dbPath, initializationQuery},
    impl,
  );

  return {
    ...baseConnector,
    getInstance() {
      if (!instance) {
        throw new Error('DuckDB not initialized');
      }
      return instance;
    },
    getConnection() {
      return ensureConnection();
    },
  };
}
