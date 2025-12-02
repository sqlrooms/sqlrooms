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
