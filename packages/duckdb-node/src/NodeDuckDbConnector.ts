import {DuckDBInstance, DuckDBConnection} from '@duckdb/node-api';
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
 * Interface representing query options.
 */
export interface QueryOptions {
  signal?: AbortSignal;
}

/**
 * Handle for managing query execution and cancellation.
 */
export type QueryHandle<T = any> = PromiseLike<T> & {
  result: Promise<T>;
  cancel: () => Promise<void>;
  signal: AbortSignal;
  catch: Promise<T>['catch'];
  finally: Promise<T>['finally'];
};

/**
 * Options for loading files into DuckDB.
 */
export interface LoadFileOptions {
  method?: string;
  schema?: string;
  [key: string]: unknown;
}

/**
 * Options for loading objects into DuckDB.
 */
export interface LoadObjectsOptions {
  schema?: string;
  replace?: boolean;
  [key: string]: unknown;
}

/**
 * DuckDB connector interface for Node.js environments.
 */
export interface NodeDuckDbConnector {
  readonly type: 'node';
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  execute(sql: string, options?: QueryOptions): QueryHandle;
  query<T extends arrow.TypeMap = any>(
    query: string,
    options?: QueryOptions,
  ): QueryHandle<arrow.Table<T>>;
  queryJson<T = Record<string, any>>(
    query: string,
    options?: QueryOptions,
  ): QueryHandle<Iterable<T>>;
  loadFile(
    fileName: string,
    tableName: string,
    opts?: LoadFileOptions,
  ): Promise<void>;
  loadArrow(
    table: arrow.Table | Uint8Array,
    tableName: string,
    opts?: {schema?: string},
  ): Promise<void>;
  loadObjects(
    data: Record<string, unknown>[],
    tableName: string,
    opts?: LoadObjectsOptions,
  ): Promise<void>;
  getInstance(): DuckDBInstance;
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
  let initialized = false;
  let initializing: Promise<void> | null = null;
  const activeQueries = new Map<string, AbortController>();

  const generateQueryId = () =>
    `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  /**
   * Converts DuckDB result to an Apache Arrow table.
   *
   * TODO: remove this once duckdb-node-neo supports arrow tables directly https://github.com/duckdb/duckdb-node-neo/issues/45
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

  /**
   * Creates a QueryHandle that wraps a promise with cancellation support.
   */
  function createQueryHandle<T>(
    queryPromiseFactory: (signal: AbortSignal, queryId: string) => Promise<T>,
    options?: QueryOptions,
  ): QueryHandle<T> {
    const abortController = new AbortController();
    const queryId = generateQueryId();

    if (options?.signal) {
      const userSignal = options.signal;
      if (userSignal.aborted) {
        abortController.abort();
      } else {
        userSignal.addEventListener('abort', () => abortController.abort());
      }
    }

    activeQueries.set(queryId, abortController);

    const resultPromise = queryPromiseFactory(
      abortController.signal,
      queryId,
    ).finally(() => {
      activeQueries.delete(queryId);
    });

    const handle: QueryHandle<T> = {
      result: resultPromise,
      signal: abortController.signal,
      cancel: async () => {
        abortController.abort();
        activeQueries.delete(queryId);
        // DuckDB node-api doesn't have explicit cancel, but aborting prevents result processing
      },
      then: resultPromise.then.bind(resultPromise),
      catch: resultPromise.catch.bind(resultPromise),
      finally: resultPromise.finally?.bind(resultPromise),
    } as unknown as QueryHandle<T>;

    return handle;
  }

  const connector: NodeDuckDbConnector = {
    get type() {
      return 'node' as const;
    },

    async initialize() {
      if (initialized) {
        return;
      }
      if (initializing) {
        return initializing;
      }

      initializing = (async () => {
        try {
          instance = await DuckDBInstance.create(dbPath, config);
          connection = await instance.connect();

          if (initializationQuery) {
            await connection.run(initializationQuery);
          }

          initialized = true;
          initializing = null;
        } catch (err) {
          initialized = false;
          initializing = null;
          instance = null;
          connection = null;
          throw err;
        }
      })();

      return initializing;
    },

    async destroy() {
      if (connection) {
        connection.closeSync();
        connection = null;
      }
      instance = null;
      initialized = false;
      initializing = null;
    },

    execute(sql: string, options?: QueryOptions): QueryHandle {
      return createQueryHandle(async (signal) => {
        if (!connection) {
          throw new Error('DuckDB not initialized');
        }
        if (signal.aborted) {
          throw new DOMException('Query was cancelled', 'AbortError');
        }
        await connection.run(sql);
      }, options);
    },

    query<T extends arrow.TypeMap = any>(
      sql: string,
      options?: QueryOptions,
    ): QueryHandle<arrow.Table<T>> {
      return createQueryHandle(async (signal) => {
        if (!connection) {
          throw new Error('DuckDB not initialized');
        }
        if (signal.aborted) {
          throw new DOMException('Query was cancelled', 'AbortError');
        }
        return resultToArrowTable<T>(connection, sql);
      }, options);
    },

    queryJson<T = Record<string, any>>(
      sql: string,
      options?: QueryOptions,
    ): QueryHandle<Iterable<T>> {
      return createQueryHandle(async (signal) => {
        if (!connection) {
          throw new Error('DuckDB not initialized');
        }
        if (signal.aborted) {
          throw new DOMException('Query was cancelled', 'AbortError');
        }
        const reader = await connection.runAndReadAll(sql);
        const rowObjects = reader.getRowObjectsJson() as T[];
        return rowObjects;
      }, options);
    },

    async loadFile(
      fileName: string,
      tableName: string,
      opts?: LoadFileOptions,
    ): Promise<void> {
      if (!connection) {
        throw new Error('DuckDB not initialized');
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

    async loadArrow(
      table: arrow.Table | Uint8Array,
      tableName: string,
      opts?: {schema?: string},
    ): Promise<void> {
      if (!connection) {
        throw new Error('DuckDB not initialized');
      }
      const schema = opts?.schema;
      const qualifiedName = schema ? `${schema}.${tableName}` : tableName;

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
        await this.loadObjects(rows, tableName, {schema, replace: true});
      } else {
        // Uint8Array - Arrow IPC format
        throw new Error(
          'Loading Arrow IPC streams is not yet supported in Node connector',
        );
      }
    },

    async loadObjects(
      data: Record<string, unknown>[],
      tableName: string,
      opts?: LoadObjectsOptions,
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

  return connector;
}
