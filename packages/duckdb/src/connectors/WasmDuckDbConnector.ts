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
      query: string,
      signal: AbortSignal,
    ): Promise<arrow.Table<T>> {
      if (!db) {
        throw new Error('DuckDB not initialized');
      }

      if (signal.aborted) {
        throw new Error('Query aborted before execution');
      }

      const localConn = await db.connect();
      const streamPromise = localConn.send<T>(query, true);
      let reader: arrow.RecordBatchReader<T> | null = null;

      const buildTable = async () => {
        reader = await streamPromise;
        const batches: arrow.RecordBatch<T>[] = [];
        let rowCount = 0;
        for await (const batch of reader) {
          if (batch.numRows === 0) continue;
          batches.push(batch);
          rowCount += batch.numRows;
        }
        if (rowCount === 0) {
          return arrow.tableFromArrays({}) as unknown as arrow.Table<T>;
        }
        return new arrow.Table(batches);
      };

      let abortHandler: (() => void) | undefined;
      const abortPromise = new Promise<never>((_, reject) => {
        abortHandler = () => {
          localConn.cancelSent().catch(() => {});
          reader?.cancel?.();
          reject(new Error('Query cancelled'));
        };
        signal.addEventListener('abort', abortHandler);
      });

      try {
        return await Promise.race([buildTable(), abortPromise]);
      } catch (e) {
        // Some errors are returned as JSON, so we try to parse them
        if (e instanceof Error) {
          const parsed: any = safeJsonParse(e.message);
          if (
            parsed !== null &&
            typeof parsed === 'object' &&
            'exception_message' in parsed
          ) {
            throw new Error(
              `${parsed.exception_type} ${parsed.error_subtype}: ${parsed.exception_message}` +
                `\n${getSqlErrorWithPointer(query, Number(parsed.position)).formatted}`,
            );
          }
        }
        throw e;
      } finally {
        if (abortHandler) {
          signal.removeEventListener('abort', abortHandler);
        }
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
