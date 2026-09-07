import {DuckDBConnection, DuckDBInstance} from '@duckdb/node-api';
import {
  BaseDuckDbConnectorImpl,
  createBaseDuckDbConnector,
  DuckDbConnector,
  literalToSQL,
} from '@sqlrooms/duckdb-core';
import {LoadFileOptions, StandardLoadOptions} from '@sqlrooms/room-config';
import * as arrow from 'apache-arrow';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  ARROW_IPC_INIT_SQL,
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
  let operationQueue = Promise.resolve();
  let closing = false;
  let destroyPromise: Promise<void> | null = null;

  const enqueueOperation = <T>(operation: () => Promise<T>): Promise<T> => {
    if (closing) {
      return Promise.reject(new Error('DuckDB connector is shutting down'));
    }
    const result = operationQueue.then(operation);
    operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const ensureConnection = (): DuckDBConnection => {
    if (!connection) {
      throw new Error('DuckDB not initialized');
    }
    return connection;
  };

  const impl: BaseDuckDbConnectorImpl = {
    async initializeInternal() {
      await enqueueOperation(async () => {
        instance = await DuckDBInstance.create(dbPath, config);
        connection = await instance.connect();
        // Required, not optional: `@duckdb/node-api` has no Arrow API, so this
        // extension IS the conversion. Failing here is deliberate — the
        // alternative was rebuilding tables from JS values, which silently
        // mistyped TIMESTAMP/DATE/BIGINT/DECIMAL and corrupted BLOB.
        await connection.run(ARROW_IPC_INIT_SQL);
      });
    },

    async destroyInternal() {
      await operationQueue;
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
      return enqueueOperation(async () => {
        if (signal.aborted) {
          throw new DOMException('Query was cancelled', 'AbortError');
        }
        return queryToArrowTable<T>(ensureConnection(), sql);
      });
    },

    async loadArrowInternal(
      table: arrow.Table | Uint8Array,
      tableName: string,
      opts?: {schema?: string},
    ): Promise<void> {
      const ipc =
        table instanceof arrow.Table
          ? arrow.tableToIPC(table, 'stream')
          : table;
      const qualifiedName = buildQualifiedName(tableName, opts?.schema);
      const tempDir = await mkdtemp(join(tmpdir(), 'sqlrooms-arrow-'));
      const tempFile = join(tempDir, 'data.arrow');

      try {
        // node-api cannot register an in-memory Arrow buffer yet. Let DuckDB's
        // nanoarrow extension scan the IPC stream through a short-lived file;
        // rebuilding rows from Vector#get() loses types and sub-millisecond
        // timestamp precision before DuckDB ever sees the values.
        await writeFile(tempFile, ipc);
        await enqueueOperation(async () => {
          await ensureConnection().run(
            `CREATE OR REPLACE TABLE ${qualifiedName} AS SELECT * FROM ${literalToSQL(tempFile)}`,
          );
        });
      } finally {
        await rm(tempDir, {recursive: true, force: true});
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
      await enqueueOperation(async () => {
        await ensureConnection().run(sql);
      });
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

      await enqueueOperation(async () => {
        await ensureConnection().run(sql);
      });
    },
  };

  const baseConnector = createBaseDuckDbConnector(
    {dbPath, initializationQuery},
    impl,
  );

  const initialize = async (): Promise<void> => {
    if (closing) {
      throw new Error('DuckDB connector is shutting down');
    }
    await baseConnector.initialize();
  };

  const destroy = (): Promise<void> => {
    if (destroyPromise) return destroyPromise;
    closing = true;
    destroyPromise = baseConnector.destroy().finally(() => {
      closing = false;
      destroyPromise = null;
    });
    return destroyPromise;
  };

  return {
    ...baseConnector,
    initialize,
    destroy,
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
