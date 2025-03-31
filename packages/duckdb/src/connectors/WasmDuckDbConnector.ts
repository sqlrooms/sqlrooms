import * as duckdb from '@duckdb/duckdb-wasm';
import {DuckDBDataProtocol, DuckDBQueryConfig} from '@duckdb/duckdb-wasm';
import {
  isSpatialLoadFileOptions,
  LoadFileOptions,
  StandardLoadOptions,
} from '@sqlrooms/project-config';
import * as arrow from 'apache-arrow';
import {DuckDbConnector} from './DuckDbConnector';
import {load, loadObjects, loadSpatial} from './load/load';

export class WasmDuckDbConnector implements DuckDbConnector {
  private logging: boolean;
  private dbPath: string;
  private initializationQuery: string;
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private worker: Worker | null = null;
  private initialized = false;
  private initializing: Promise<void> | null = null;
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
    this.dbPath = dbPath;
    this.queryConfig = queryConfig;
    this.initializationQuery = initializationQuery;
    this.logging = logging;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializing) {
      return this.initializing;
    }

    if (!globalThis.Worker) {
      throw new Error('No Worker support in this environment');
    }

    this.initializing = this.initializeInternal();
    return this.initializing;
  }

  private async initializeInternal(): Promise<void> {
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

      const conn = await db.connect();

      // Add error handling to conn.query
      const originalQuery = conn.query;
      conn.query = (async (q: string) => {
        const stack = new Error().stack;
        try {
          return await originalQuery.call(conn, q);
        } catch (err) {
          throw new DuckQueryError(err, q, stack);
        }
      }) as typeof conn.query;

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

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async query(query: string): Promise<arrow.Table> {
    await this.ensureInitialized();
    if (!this.conn) {
      throw new Error('DuckDB connection not initialized');
    }
    return await this.conn.query(query);
  }

  async loadFile(
    file: string | File,
    tableName: string,
    opts?: LoadFileOptions,
  ) {
    await this.withTempRegisteredFile(file, async (conn, fileName) => {
      if (opts && isSpatialLoadFileOptions(opts)) {
        await conn.query(loadSpatial(tableName, fileName, opts));
      } else {
        await conn.query(
          load(opts?.method ?? 'auto', tableName, fileName, opts),
        );
      }
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
    action: (
      conn: duckdb.AsyncDuckDBConnection,
      fileName: string,
    ) => Promise<void>,
  ) {
    await this.ensureInitialized();
    if (!this.conn || !this.db) {
      throw new Error('DuckDB connection not initialized');
    }
    let fileName: string;
    if (file instanceof File) {
      fileName = file.name;
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
      await action(this.conn, fileName);
    } finally {
      await this.db.dropFile(fileName);
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
