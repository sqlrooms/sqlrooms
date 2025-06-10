import * as duckdb from '@duckdb/duckdb-wasm';
import {DuckDBDataProtocol, DuckDBQueryConfig} from '@duckdb/duckdb-wasm';
import {LoadFileOptions, StandardLoadOptions} from '@sqlrooms/project-config';
import {splitFilePath} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {BaseDuckDbConnector} from './BaseDuckDbConnector';
import {loadObjects} from './load/load';

export class WasmDuckDbConnector extends BaseDuckDbConnector {
  private logging: boolean;
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private worker: Worker | null = null;
  private queryConfig?: DuckDBQueryConfig;

  constructor({
    logging = false,
    initializationQuery = '',
    dbPath = ':memory:',
    queryConfig,
  }: {
    dbPath?: string;
    queryConfig?: DuckDBQueryConfig;
    initializationQuery?: string;
    logging?: boolean;
  } = {}) {
    super({dbPath, initializationQuery});
    this.queryConfig = queryConfig;
    this.logging = logging;
  }

  protected async initializeInternal(): Promise<void> {
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

      const worker = new window.Worker(workerUrl);
      const logger = this.logging
        ? new duckdb.ConsoleLogger()
        : {
            // Silently log
            log: () => {
              /* do nothing */
            },
          };

      const db = new (class extends duckdb.AsyncDuckDB {
        onError(event: ErrorEvent) {
          super.onError(event);
          console.error('DuckDB worker error:', event);
        }
      })(logger, worker);

      await db.instantiate(bestBundle.mainModule, bestBundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);

      await db.open({
        path: this.dbPath,
        query: this.queryConfig,
      });

      const conn = augmentConnectionQueryError(await db.connect());
      if (this.initializationQuery) {
        await conn.query(this.initializationQuery);
      }

      this.db = db;
      this.conn = conn;
      this.worker = worker;
      this.initialized = true;
    } catch (err) {
      this.initialized = false;
      this.initializing = null;
      throw err;
    }
  }

  async destroy(): Promise<void> {
    try {
      if (this.conn) {
        await this.conn.close();
        this.conn = null;
      }

      if (this.db) {
        await this.db.terminate();
        this.db = null;
      }

      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }

      this.initialized = false;
      this.initializing = null;
    } catch (err) {
      console.error('Error during DuckDB shutdown:', err);
      throw err;
    }
  }

  protected async executeQueryInternal<T extends arrow.TypeMap = any>(
    query: string,
    signal: AbortSignal,
  ): Promise<arrow.Table<T>> {
    // Make sure the WASM runtime is ready.
    await this.ensureInitialized();
    if (!this.db) {
      throw new Error('DuckDB not initialized');
    }

    // Short‑circuit if the caller already aborted.
    if (signal.aborted) {
      throw new Error('Query aborted before execution');
    }

    // 👉  Open a *fresh* connection dedicated to this request.
    const conn = augmentConnectionQueryError(await this.db.connect());

    // 1️⃣ Kick‑off the statement using the *cancellable* streaming API
    const streamPromise = conn.send<T>(query, /* allowStreamResult */ true);

    // Handle to the Arrow reader so we can cancel it later.
    let reader: arrow.RecordBatchReader<T> | null = null;

    // 2️⃣ Helper to materialise all batches into one Arrow Table.
    const buildTable = async () => {
      reader = await streamPromise;

      const batches: arrow.RecordBatch<T>[] = [];
      let rowCount = 0;

      for await (const batch of reader) {
        // DuckDB‑wasm may emit an empty placeholder batch when connections
        // race.  Ignore any batch whose `numRows` is zero.
        if (batch.numRows === 0) continue;

        batches.push(batch);
        rowCount += batch.numRows;
      }

      if (rowCount === 0) {
        return arrow.tableFromArrays({}) as unknown as arrow.Table<T>;
      }
      return new arrow.Table(batches);
    };

    // 3️⃣ Wire the AbortSignal → DuckDB interrupt.
    let abortHandler: (() => void) | undefined;
    const abortPromise = new Promise<never>((_, reject) => {
      abortHandler = () => {
        // Interrupt DuckDB *and* stop the Arrow stream
        conn.cancelSent().catch(() => {
          /* ignore if nothing to cancel */
        });
        reader?.cancel?.();
        reject(new Error('Query cancelled'));
      };
      signal.addEventListener('abort', abortHandler);
    });

    try {
      // Whichever finishes first (query or cancel) wins.
      return await Promise.race([buildTable(), abortPromise]);
    } finally {
      if (abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
      // Always close the per‑query connection.
      await conn.close();
    }
  }

  protected async cancelQueryInternal(queryId: string): Promise<void> {
    // First, invoke the base‑class logic (removes AbortController listeners, etc.)
    await super.cancelQueryInternal(queryId);

    // Then, interrupt the running statement on the DuckDB side.
    if (this.conn) {
      try {
        await this.conn.cancelSent();
      } catch (err) {
        // If no statement is active or interrupt fails, just log and move on.
        console.warn('DuckDB cancelSent failed:', err);
      }
    }
  }

  async loadFile(
    file: string | File,
    tableName: string,
    opts?: LoadFileOptions,
  ) {
    await this.withTempRegisteredFile(file, async (fileName) => {
      await super.loadFile(fileName, tableName, opts);
    });
  }

  async loadArrow(
    file: arrow.Table | Uint8Array,
    tableName: string,
    opts?: {schema?: string},
  ) {
    await this.ensureInitialized();
    if (!this.conn) {
      throw new Error('DuckDB connection not initialized');
    }
    const options = {name: tableName, schema: opts?.schema};
    if (file instanceof arrow.Table) {
      await this.conn.insertArrowTable(file, options);
    } else {
      await this.conn.insertArrowFromIPCStream(file, options);
    }
  }

  async loadObjects(
    file: Record<string, unknown>[],
    tableName: string,
    opts?: StandardLoadOptions,
  ) {
    await this.ensureInitialized();
    if (!this.conn) {
      throw new Error('DuckDB connection not initialized');
    }
    await this.conn.query(loadObjects(tableName, file, opts));
  }

  private async withTempRegisteredFile(
    file: string | File,
    action: (fileName: string) => Promise<void>,
  ) {
    await this.ensureInitialized();
    if (!this.conn || !this.db) {
      throw new Error('DuckDB connection not initialized');
    }
    let fileName: string;
    let tempFileName: string | undefined = undefined;
    if (file instanceof File) {
      // Extension might help DuckDB determine the file type
      const {ext} = splitFilePath(file.name);
      tempFileName = `${Math.random().toString(36).substring(2, 15)}${ext ? `.${ext}` : ''}`;
      fileName = tempFileName;
      await this.db.registerFileHandle(
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
    } catch (err) {
      console.error(`Error during file loading "${fileName}":`, err);
      throw err;
    } finally {
      if (tempFileName) {
        await this.db.dropFile(tempFileName);
      }
    }
  }

  getDb(): duckdb.AsyncDuckDB {
    if (!this.db) {
      throw new Error('DuckDB not initialized');
    }
    return this.db;
  }

  getConnection(): duckdb.AsyncDuckDBConnection {
    if (!this.conn) {
      throw new Error('DuckDB connection not initialized');
    }
    return this.conn;
  }
}

/**
 * Augment the connection query method to include the full query and stack trace in the error.
 * @param conn - The connection to augment.
 * @returns The augmented connection.
 */
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
    const {message} = this;
    return message;
  }
}
