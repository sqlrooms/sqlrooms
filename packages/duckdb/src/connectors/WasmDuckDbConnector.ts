import * as duckdb from '@duckdb/duckdb-wasm';
import {DuckDBDataProtocol} from '@duckdb/duckdb-wasm';
import {
  LoadFileOptions,
  StandardLoadOptions,
  isSpatialLoadFileOptions,
} from '@sqlrooms/room-config';
import {safeJsonParse, splitFilePath} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {
  BaseDuckDbConnectorImpl,
  createBaseDuckDbConnector,
} from './BaseDuckDbConnector';
import {DuckDbConnector} from './DuckDbConnector';
import {load, loadObjects as loadObjectsSql, loadSpatial} from './load/load';
import {getSqlErrorWithPointer} from '../duckdb-utils';

export interface WasmDuckDbConnectorOptions extends duckdb.DuckDBConfig {
  /** @deprecated use `path` instead */
  dbPath?: string;
  initializationQuery?: string;
  logging?: boolean;
  /**
   * DuckDB bundles to use. Defaults to jsDelivr bundles. To use locally
   * bundled files, you will need to import them in your app and construct a
   * `DuckDBBundles` object.
   */
  bundles?: duckdb.DuckDBBundles;
}

export interface WasmDuckDbConnector extends DuckDbConnector {
  getDb(): duckdb.AsyncDuckDB;
  getConnection(): duckdb.AsyncDuckDBConnection;
  readonly type: 'wasm';
}

export function createWasmDuckDbConnector(
  options: WasmDuckDbConnectorOptions = {},
): WasmDuckDbConnector {
  const {
    logging = false,
    initializationQuery = '',
    dbPath = ':memory:',
    bundles = duckdb.getJsDelivrBundles(),
    ...restConfig
  } = options;

  let db: duckdb.AsyncDuckDB | null = null;
  let conn: duckdb.AsyncDuckDBConnection | null = null;
  let worker: Worker | null = null;

  const impl: BaseDuckDbConnectorImpl = {
    async initializeInternal() {
      if (!globalThis.Worker) {
        throw new Error('No Worker support in this environment');
      }
      try {
        const allBundles = bundles;
        const bestBundle = await duckdb.selectBundle(allBundles);
        if (!bestBundle.mainWorker) {
          throw new Error('No best bundle found for DuckDB worker');
        }
        const workerScriptUrl = new URL(
          bestBundle.mainWorker,
          globalThis.location.origin,
        ).href;
        const workerUrl = URL.createObjectURL(
          new Blob([`importScripts("${workerScriptUrl}");`], {
            type: 'text/javascript',
          }),
        );

        worker = new window.Worker(workerUrl);
        const logger = logging ? new duckdb.ConsoleLogger() : {log: () => {}};

        db = new (class extends duckdb.AsyncDuckDB {
          onError(event: ErrorEvent) {
            super.onError(event);
            console.error('DuckDB worker error:', event);
          }
        })(logger, worker);

        const mainModule = new URL(
          bestBundle.mainModule,
          globalThis.location.origin,
        ).href;
        const pthreadWorker = bestBundle.pthreadWorker
          ? new URL(bestBundle.pthreadWorker, globalThis.location.origin).href
          : undefined;
        await db.instantiate(mainModule, pthreadWorker);
        URL.revokeObjectURL(workerUrl);

        await db.open({
          ...restConfig,
          path: restConfig.path ?? dbPath,
        });

        conn = await db.connect();
      } catch (err) {
        db = null;
        conn = null;
        worker = null;
        throw err;
      }
    },

    async destroyInternal() {
      if (conn) {
        await conn.close();
        conn = null;
      }
      if (db) {
        await db.terminate();
        db = null;
      }
      if (worker) {
        worker.terminate();
        worker = null;
      }
    },

    async executeQueryInternal<T extends arrow.TypeMap = any>(
      query: string | string[],
      signal: AbortSignal,
    ): Promise<arrow.Table<T>> {
      if (!db) {
        throw new Error('DuckDB not initialized');
      }

      if (signal.aborted) {
        throw new Error('Query aborted before execution');
      }

      const localConn = await db.connect();

      // Helper function to parse and throw SQL errors
      const throwSqlError = (error: unknown, statement: string) => {
        if (error instanceof Error) {
          const parsed: any = safeJsonParse(error.message);
          if (
            parsed !== null &&
            typeof parsed === 'object' &&
            'exception_message' in parsed
          ) {
            throw new Error(
              `${parsed.exception_type} ${parsed.error_subtype}: ${parsed.exception_message}` +
                `\n${getSqlErrorWithPointer(statement, Number(parsed.position)).formatted}`,
            );
          }
        }
        throw error;
      };

      // Helper function to execute a single statement
      const executeStatement = async (
        stmt: string,
        buildTable: boolean,
      ): Promise<arrow.Table<T> | null> => {
        const streamPromise = localConn.send<T>(stmt, true);
        let reader: arrow.RecordBatchReader<T> | null = null;

        try {
          reader = await streamPromise;

          if (buildTable) {
            // Build table for the result
            const batches: arrow.RecordBatch<T>[] = [];
            let rowCount = 0;
            for await (const batch of reader) {
              if (signal.aborted) {
                throw new Error('Query cancelled');
              }
              if (batch.numRows === 0) continue;
              batches.push(batch);
              rowCount += batch.numRows;
            }
            if (rowCount === 0) {
              return arrow.tableFromArrays({}) as unknown as arrow.Table<T>;
            }
            return new arrow.Table(batches);
          } else {
            // Just consume the stream to ensure completion
            for await (const batch of reader) {
              if (signal.aborted) {
                throw new Error('Query cancelled');
              }
              // Don't store batches, just consume them
            }
            return null;
          }
        } catch (e) {
          throwSqlError(e, stmt);
          return null; // Never reached, but TypeScript needs it
        }
      };

      try {
        // Handle multiple statements by executing them individually
        if (Array.isArray(query)) {
          let lastResult: arrow.Table<T> | null = null;

          for (let i = 0; i < query.length; i++) {
            if (signal.aborted) {
              throw new Error('Query cancelled');
            }

            const stmt = query[i]?.trim();
            if (!stmt) continue; // Skip empty statements

            const isLastStatement = i === query.length - 1;
            const result = await executeStatement(stmt, isLastStatement);

            if (isLastStatement && result) {
              lastResult = result;
            }
          }

          // Return the result from the last statement, or empty table if no statements
          return (
            lastResult ||
            (arrow.tableFromArrays({}) as unknown as arrow.Table<T>)
          );
        } else {
          // Single statement execution with abort handling
          let abortHandler: (() => void) | undefined;
          const abortPromise = new Promise<never>((_, reject) => {
            abortHandler = () => {
              localConn.cancelSent().catch(() => {});
              reject(new Error('Query cancelled'));
            };
            signal.addEventListener('abort', abortHandler);
          });

          try {
            const resultPromise = executeStatement(query, true);
            const result = await Promise.race([resultPromise, abortPromise]);
            return (
              result || (arrow.tableFromArrays({}) as unknown as arrow.Table<T>)
            );
          } catch (e) {
            throwSqlError(e, query);
            return null as never; // Never reached
          } finally {
            if (abortHandler) {
              signal.removeEventListener('abort', abortHandler);
            }
          }
        }
      } finally {
        await localConn.close();
      }
    },

    async cancelQueryInternal() {
      if (conn) {
        try {
          await conn.cancelSent();
        } catch (err) {
          console.warn('DuckDB cancelSent failed:', err);
        }
      }
    },

    async loadFileInternal(
      file: string | File,
      tableName: string,
      opts?: LoadFileOptions,
    ) {
      if (!conn) {
        throw new Error('DuckDB connection not initialized');
      }
      await withTempRegisteredFile(file, async (fileName) => {
        if (opts && isSpatialLoadFileOptions(opts)) {
          await conn!.query(loadSpatial(tableName, fileName, opts));
        } else {
          await conn!.query(
            load(opts?.method ?? 'auto', tableName, fileName, opts),
          );
        }
      });
    },

    async loadArrowInternal(
      file: arrow.Table | Uint8Array,
      tableName: string,
      opts?: {schema?: string},
    ) {
      if (!conn) {
        throw new Error('DuckDB connection not initialized');
      }
      const options = {name: tableName, schema: opts?.schema};
      if (file instanceof arrow.Table) {
        await conn.insertArrowTable(file, options);
      } else {
        await conn.insertArrowFromIPCStream(file, options);
      }
    },

    async loadObjectsInternal(
      file: Record<string, unknown>[],
      tableName: string,
      opts?: StandardLoadOptions,
    ) {
      if (!conn) {
        throw new Error('DuckDB connection not initialized');
      }
      await conn.query(loadObjectsSql(tableName, file, opts));
    },
  };

  const base = createBaseDuckDbConnector({dbPath, initializationQuery}, impl);

  async function withTempRegisteredFile(
    file: string | File,
    action: (fileName: string) => Promise<void>,
  ) {
    if (!conn || !db) {
      throw new Error('DuckDB connection not initialized');
    }
    let fileName: string;
    let tempFileName: string | undefined = undefined;
    if (file instanceof File) {
      const {ext} = splitFilePath(file.name);
      tempFileName = `${Math.random().toString(36).substring(2, 15)}${ext ? `.${ext}` : ''}`;
      fileName = tempFileName;
      await db.registerFileHandle(
        fileName,
        file,
        DuckDBDataProtocol.BROWSER_FILEREADER,
        true,
      );
    } else {
      fileName = file;
    }
    try {
      await action(fileName);
    } finally {
      if (tempFileName) {
        await db!.dropFile(tempFileName);
      }
    }
  }

  return {
    ...base,
    getDb() {
      if (!db) {
        throw new Error('DuckDB not initialized');
      }
      return db;
    },
    getConnection() {
      if (!conn) {
        throw new Error('DuckDB connection not initialized');
      }
      return conn;
    },
    get type() {
      return 'wasm' as const;
    },
  };
}
