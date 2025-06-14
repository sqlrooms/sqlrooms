import * as duckdb from '@duckdb/duckdb-wasm';
import {DuckDBDataProtocol, DuckDBQueryConfig} from '@duckdb/duckdb-wasm';
import {
  LoadFileOptions,
  StandardLoadOptions,
  isSpatialLoadFileOptions,
} from '@sqlrooms/project-config';
import {splitFilePath} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {
  createBaseDuckDbConnector,
  BaseDuckDbConnectorImpl,
} from './BaseDuckDbConnector';
import {loadObjects as loadObjectsSql, load, loadSpatial} from './load/load';
import {DuckDbConnector} from './DuckDbConnector';

export interface WasmDuckDbConnectorOptions {
  dbPath?: string;
  queryConfig?: DuckDBQueryConfig;
  initializationQuery?: string;
  logging?: boolean;
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
    queryConfig,
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
        const allBundles = duckdb.getJsDelivrBundles();
        const bestBundle = await duckdb.selectBundle(allBundles);
        if (!bestBundle.mainWorker) {
          throw new Error('No best bundle found for DuckDB worker');
        }
        const workerUrl = URL.createObjectURL(
          new Blob([`importScripts("${bestBundle.mainWorker}");`], {
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

        await db.instantiate(bestBundle.mainModule, bestBundle.pthreadWorker);
        URL.revokeObjectURL(workerUrl);

        await db.open({
          path: dbPath,
          query: queryConfig,
        });

        conn = augmentConnectionQueryError(await db.connect());
        if (initializationQuery) {
          await conn.query(initializationQuery);
        }
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

      const localConn = augmentConnectionQueryError(await db.connect());
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

function augmentConnectionQueryError(conn: duckdb.AsyncDuckDBConnection) {
  const originalQuery = conn.query;
  conn.query = (async (q: string) => {
    const stack = new Error().stack;
    try {
      return await originalQuery.call(conn, q);
    } catch (err) {
      throw new DuckQueryError(err, q, stack);
    }
  }) as typeof conn.query;
  return conn;
}

export class DuckQueryError extends Error {
  readonly cause: unknown;
  readonly query: string | undefined;
  readonly queryCallStack: string | undefined;
  constructor(err: unknown, query: string, stack: string | undefined) {
    super(err instanceof Error ? err.message : `${err}`);
    this.cause = err;
    this.query = query;
    this.queryCallStack = stack;
    Object.setPrototypeOf(this, DuckQueryError.prototype);
  }
  getDetailedMessage() {
    const {message, query, queryCallStack: stack} = this;
    return (
      `DB query failed: ${message}` +
      `\n\nFull query:\n\n${query}\n\nQuery call stack:\n\n${stack}\n\n`
    );
  }
  getMessageForUser() {
    return this.message;
  }
}
