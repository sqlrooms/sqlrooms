import {DuckDBConnection, DuckDBInstance} from '@duckdb/node-api';
import {
  BaseDuckDbConnectorImpl,
  createBaseDuckDbConnector,
  DuckDbConnector,
} from '@sqlrooms/duckdb-core';
import {LoadFileOptions, StandardLoadOptions} from '@sqlrooms/room-config';
import * as arrow from 'apache-arrow';

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

  /**
   * Converts DuckDB result to an Apache Arrow table.
   *
   * TODO: remove this once duckdb-node-neo supports arrow tables directly
   * https://github.com/duckdb/duckdb-node-neo/issues/45
   */
  async function resultToArrowTable<T extends arrow.TypeMap = any>(
    conn: DuckDBConnection,
    sql: string,
  ): Promise<arrow.Table<T>> {
    const reader = await conn.runAndReadAll(sql);
    const columnNames = reader.columnNames();
    const columns = reader.getColumnsJson();

    if (columnNames.length === 0 || reader.currentRowCount === 0) {
      return arrow.tableFromArrays({}) as unknown as arrow.Table<T>;
    }

    // Build a simple object with column name -> array mapping
    const columnsObject: Record<string, unknown[]> = {};
    for (let i = 0; i < columnNames.length; i++) {
      const name = columnNames[i] as string;
      const columnData = columns[i] ?? [];
      // Convert BigInt to number for Arrow compatibility
      columnsObject[name] = (columnData as unknown[]).map((v) => {
        if (typeof v === 'bigint') {
          // Convert to number if within safe range
          if (v >= Number.MIN_SAFE_INTEGER && v <= Number.MAX_SAFE_INTEGER) {
            return Number(v);
          }
          return v.toString();
        }
        return v;
      });
    }

    return arrow.tableFromArrays(columnsObject) as unknown as arrow.Table<T>;
  }

  const impl: BaseDuckDbConnectorImpl = {
    async initializeInternal() {
      instance = await DuckDBInstance.create(dbPath, config);
      connection = await instance.connect();
    },

    async destroyInternal() {
      if (connection) {
        connection.closeSync();
        connection = null;
      }
      instance = null;
    },

    async executeQueryInternal<T extends arrow.TypeMap = any>(
      sql: string,
      signal: AbortSignal,
    ): Promise<arrow.Table<T>> {
      if (!connection) {
        throw new Error('DuckDB not initialized');
      }
      if (signal.aborted) {
        throw new DOMException('Query was cancelled', 'AbortError');
      }
      return resultToArrowTable<T>(connection, sql);
    },

    async loadArrowInternal(
      table: arrow.Table | Uint8Array,
      tableName: string,
      opts?: {schema?: string},
    ): Promise<void> {
      if (!connection) {
        throw new Error('DuckDB not initialized');
      }
      const schema = opts?.schema;

      // Convert Arrow table to JSON and insert
      if (table instanceof arrow.Table) {
        const rows: Record<string, unknown>[] = [];
        for (let i = 0; i < table.numRows; i++) {
          const row: Record<string, unknown> = {};
          for (const field of table.schema.fields) {
            const col = table.getChild(field.name);
            row[field.name] = col?.get(i);
          }
          rows.push(row);
        }
        await impl.loadObjectsInternal!(rows, tableName, {
          schema,
          replace: true,
        });
      } else {
        // Uint8Array - Arrow IPC format
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
      if (!connection) {
        throw new Error('DuckDB not initialized');
      }
      if (data.length === 0) {
        throw new Error('Cannot load empty data array');
      }

      const schema = opts?.schema;
      const qualifiedName = schema ? `${schema}.${tableName}` : tableName;

      // Convert objects to VALUES clause
      const columns = Object.keys(data[0] as Record<string, unknown>);
      const columnList = columns.map((c) => `"${c}"`).join(', ');

      const valueRows = data.map((row) => {
        const values = columns.map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
          if (typeof val === 'bigint') return val.toString();
          if (typeof val === 'object') return `'${JSON.stringify(val)}'`;
          return String(val);
        });
        return `(${values.join(', ')})`;
      });

      const sql = `CREATE OR REPLACE TABLE ${qualifiedName} (${columnList}) AS 
        SELECT * FROM (VALUES ${valueRows.join(', ')}) AS t(${columnList})`;
      await connection.run(sql);
    },

    async loadFileInternal(
      fileName: string | File,
      tableName: string,
      opts?: LoadFileOptions,
    ): Promise<void> {
      if (!connection) {
        throw new Error('DuckDB not initialized');
      }
      if (fileName instanceof File) {
        throw new Error('File objects are not supported in Node connector');
      }

      const method = opts?.method ?? 'auto';
      const schema = opts?.schema;
      const qualifiedName = schema ? `${schema}.${tableName}` : tableName;

      let sql: string;
      if (method === 'auto') {
        sql = `CREATE OR REPLACE TABLE ${qualifiedName} AS SELECT * FROM '${fileName}'`;
      } else {
        sql = `CREATE OR REPLACE TABLE ${qualifiedName} AS SELECT * FROM ${method}('${fileName}')`;
      }
      await connection.run(sql);
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
      if (!connection) {
        throw new Error('DuckDB not initialized');
      }
      return connection;
    },
  };
}
