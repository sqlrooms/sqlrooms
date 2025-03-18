import * as duckdb from '@duckdb/duckdb-wasm';
import * as arrow from 'apache-arrow';
import {
  DataTable,
  DuckDbConnector,
  DuckQueryExecutionResult,
  TableColumn,
} from './types';
import {DuckQueryError} from './useDuckDb';
import {DuckDBDataProtocol} from '@duckdb/duckdb-wasm';
import {genRandomStr} from '@sqlrooms/utils';

const ENABLE_DUCK_LOGGING = false;

const SilentLogger = {
  log: () => {
    /* do nothing */
  },
};

export class WasmDuckDbConnector implements DuckDbConnector {
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private worker: Worker | null = null;
  private initialized = false;
  private initializing: Promise<void> | null = null;

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
      const logger = ENABLE_DUCK_LOGGING
        ? new duckdb.ConsoleLogger()
        : SilentLogger;

      const db = new (class extends duckdb.AsyncDuckDB {
        onError(event: ErrorEvent) {
          super.onError(event);
          console.error('DuckDB worker error:', event);
        }
      })(logger, worker);

      await db.instantiate(bestBundle.mainModule, bestBundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);

      await db.open({
        path: ':memory:',
        query: {
          // castBigIntToDouble: true
        },
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

      await conn.query(`
        SET max_expression_depth TO 100000;
        SET memory_limit = '10GB';
      `);

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
  ): Promise<DuckQueryExecutionResult> {
    await this.ensureInitialized();

    if (!this.db || !this.conn) {
      throw new Error('DuckDB not initialized');
    }

    let fileName: string;
    let protocol: DuckDBDataProtocol;

    if (typeof file === 'string') {
      // Assume it's a URL if it's a string
      fileName = file;
      protocol = DuckDBDataProtocol.HTTP;
    } else {
      // It's a File object
      const fileExt = file.name.split('.').pop() || '';
      fileName = `${genRandomStr(6).toLowerCase()}.${fileExt}`;
      protocol = DuckDBDataProtocol.BROWSER_FILEREADER;
      await this.db.registerFileHandle(fileName, file, protocol, true);
    }

    // Create a view from the file
    try {
      // First determine row count
      const countResult = await this.conn.query(
        `SELECT COUNT(*) FROM '${fileName}'`,
      );
      const rowCount = Number(countResult.getChildAt(0)?.get(0));

      // Create the view
      await this.conn.query(
        `CREATE OR REPLACE VIEW ${tableName} AS SELECT * FROM '${fileName}'`,
      );

      // Get the data for the caller
      const arrowTable = await this.conn.query(
        `SELECT * FROM ${tableName} LIMIT 1000`,
      );

      return {arrowTable, rowCount};
    } catch (err) {
      throw new Error(`Failed to load file: ${err}`);
    }
  }

  async dropFile(fileName: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) {
      throw new Error('DuckDB not initialized');
    }
    this.db.dropFile(fileName);
  }

  async tableExists(tableName: string, schema = 'main'): Promise<boolean> {
    await this.ensureInitialized();
    const result = await this.query(
      `SELECT COUNT(*) FROM information_schema.tables 
       WHERE table_schema = '${schema}' AND table_name = '${tableName}'`,
    );
    return Number(result.getChildAt(0)?.get(0)) > 0;
  }

  async getTables(schema = 'main'): Promise<string[]> {
    await this.ensureInitialized();
    const result = await this.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = '${schema}'
       ORDER BY table_name`,
    );

    const tableNames: string[] = [];
    const tableNameCol = result.getChild('table_name');

    if (tableNameCol) {
      for (let i = 0; i < result.numRows; i++) {
        tableNames.push(tableNameCol.get(i) as string);
      }
    }

    return tableNames;
  }

  async getTableSchema(tableName: string, schema = 'main'): Promise<DataTable> {
    await this.ensureInitialized();
    const describeResults = await this.query(`DESCRIBE ${schema}.${tableName}`);

    const columns: TableColumn[] = [];
    const columnNames = describeResults.getChild('column_name');
    const columnTypes = describeResults.getChild('column_type');

    if (columnNames && columnTypes) {
      for (let i = 0; i < describeResults.numRows; i++) {
        columns.push({
          name: columnNames.get(i) as string,
          type: columnTypes.get(i) as string,
        });
      }
    }

    return {
      tableName,
      columns,
    };
  }

  async getTableSchemas(schema = 'main'): Promise<DataTable[]> {
    const tableNames = await this.getTables(schema);
    const tables: DataTable[] = [];

    for (const tableName of tableNames) {
      tables.push(await this.getTableSchema(tableName, schema));
    }

    return tables;
  }

  async dropTable(tableName: string): Promise<void> {
    await this.ensureInitialized();
    await this.query(`DROP TABLE IF EXISTS ${tableName}`);
  }

  // Methods to expose internal implementation details for backwards compatibility

  /**
   * @internal For backwards compatibility only
   */
  getDb(): duckdb.AsyncDuckDB {
    if (!this.db) {
      throw new Error('DuckDB not initialized');
    }
    return this.db;
  }

  /**
   * @internal For backwards compatibility only
   */
  getConn(): duckdb.AsyncDuckDBConnection {
    if (!this.conn) {
      throw new Error('DuckDB connection not initialized');
    }
    return this.conn;
  }

  /**
   * @internal For backwards compatibility only
   */
  getWorker(): Worker {
    if (!this.worker) {
      throw new Error('DuckDB worker not initialized');
    }
    return this.worker;
  }
}
