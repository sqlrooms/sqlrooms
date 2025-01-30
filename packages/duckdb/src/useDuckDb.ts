import * as duckdb from '@duckdb/duckdb-wasm';
import * as arrow from 'apache-arrow';
import {DataTable, TableColumn} from './types';

/**
 * @deprecated DuckConn is deprecated, use DuckDb instead
 */
export type DuckConn = DuckDb;

export type DuckDb = {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
  worker: Worker;
};

const ENABLE_DUCK_LOGGING = false;

const SilentLogger = {
  log: () => {
    /* do nothing */
  },
};

// TODO: shut DB down at some point

let duckConn: DuckDb;
let initialize: Promise<DuckDb> | undefined;

export class DuckQueryError extends Error {
  readonly cause: unknown;
  readonly query: string | undefined;
  readonly queryCallStack: string | undefined;
  constructor(err: unknown, query: string, stack: string | undefined) {
    super(
      `DB query failed: ${
        err instanceof Error ? err.message : err
      }\n\nFull query:\n\n${query}\n\nQuery call stack:\n\n${stack}\n\n`,
    );
    this.cause = err;
    this.query = query;
    this.queryCallStack = stack;
    Object.setPrototypeOf(this, DuckQueryError.prototype);
  }
  getMessageForUser() {
    const msg = this.cause instanceof Error ? this.cause.message : this.message;
    return msg;
  }
}

/**
 * @deprecated getDuckConn is deprecated, use getDuckDb instead
 */
export const getDuckConn = getDuckDb;

export async function getDuckDb(): Promise<DuckDb> {
  if (!globalThis.Worker) {
    return Promise.reject('No Worker support');
  }
  if (duckConn) {
    return duckConn;
  } else if (initialize !== undefined) {
    // The initialization has already been started, wait for it to finish
    return initialize;
  }

  let resolve: (value: DuckDb) => void;
  let reject: (reason?: unknown) => void;
  initialize = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  try {
    // TODO: Consider to load locally https://github.com/duckdb/duckdb-wasm/issues/1425#issuecomment-1742156605
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
    // const worker = await duckdb.createWorker(bestBundle.mainWorker);
    const worker = new window.Worker(workerUrl);
    const logger = ENABLE_DUCK_LOGGING
      ? new duckdb.ConsoleLogger()
      : SilentLogger;
    const db = new (class extends duckdb.AsyncDuckDB {
      onError(event: ErrorEvent) {
        super.onError(event);
        console.error('onError', event);
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
    // Replace conn.query to include full query in the error message
    const connQuery = conn.query;
    conn.query = (async (q: string) => {
      const stack = new Error().stack;
      try {
        return await connQuery.call(conn, q);
      } catch (err) {
        throw new DuckQueryError(err, q, stack);
        // throw new Error(
        //   `Query failed: ${err}\n\nFull query:\n\n${q}\n\nQuery call stack:\n\n${stack}\n\n`,
        // );
      }
    }) as typeof conn.query;
    await conn.query(`
      SET max_expression_depth TO 100000;
      SET memory_limit = '10GB';
    `);
    duckConn = {db, conn, worker};
    resolve!(duckConn);
  } catch (err) {
    reject!(err);
    throw err;
  }

  return duckConn;
}

// Cache the promise to avoid multiple initialization attempts
let duckPromise: Promise<DuckDb> | null = null;

/**
 * @deprecated useDuckConn is deprecated, use useDuckDb instead
 */
export const useDuckConn = useDuckDb;

export function useDuckDb(): DuckDb {
  if (!duckPromise) {
    duckPromise = getDuckDb();
  }

  // If we don't have a connection yet, throw the promise
  // This will trigger Suspense
  if (!duckConn) {
    throw duckPromise;
  }

  return duckConn;
}

export const isNumericDuckType = (type: string) =>
  type.indexOf('INT') >= 0 ||
  type.indexOf('DECIMAL') >= 0 ||
  type.indexOf('FLOAT') >= 0 ||
  type.indexOf('REAL') >= 0 ||
  type.indexOf('DOUBLE') >= 0;

export function getColValAsNumber(
  res: arrow.Table,
  column: string | number = 0,
  index = 0,
): number {
  const v = (
    typeof column === 'number' ? res.getChildAt(column) : res.getChild(column)
  )?.get(index);
  if (v === undefined || v === null) {
    return NaN;
  }
  // if it's an array (can be returned by duckdb as bigint)
  return Number(v[0] ?? v);
}

export const escapeVal = (val: unknown) => {
  return `'${String(val).replace(/'/g, "''")}'`;
};

export const escapeId = (id: string) => {
  const str = String(id);
  if (str.startsWith('"') && str.endsWith('"')) {
    return str;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

export async function getDuckTables(schema = 'main'): Promise<string[]> {
  const {conn} = await getDuckDb();
  const tablesResults = await conn.query(
    `SELECT * FROM information_schema.tables 
     WHERE table_schema = '${schema}'
     ORDER BY table_name`,
  );
  const tableNames: string[] = [];
  for (let i = 0; i < tablesResults.numRows; i++) {
    tableNames.push(tablesResults.getChild('table_name')?.get(i));
  }
  return tableNames;
}

export async function getDuckTableSchema(
  tableName: string,
  schema = 'main',
): Promise<DataTable> {
  const {conn} = await getDuckDb();
  const describeResults = await conn.query(`DESCRIBE ${schema}.${tableName}`);
  const columnNames = describeResults.getChild('column_name');
  const columnTypes = describeResults.getChild('column_type');
  const columns: TableColumn[] = [];
  for (let di = 0; di < describeResults.numRows; di++) {
    const columnName = columnNames?.get(di);
    const columnType = columnTypes?.get(di);
    columns.push({name: columnName, type: columnType});
  }
  return {
    tableName,
    columns,
    // Costly to get the row count for large tables
    // rowCount: getColValAsNumber(
    //   await conn.query(`SELECT COUNT(*) FROM ${schema}.${tableName}`),
    // ),
  };
}

export async function getDuckTableSchemas(
  schema = 'main',
): Promise<DataTable[]> {
  const tableNames = await getDuckTables(schema);
  const tablesInfo: DataTable[] = [];
  for (const tableName of tableNames) {
    tablesInfo.push(await getDuckTableSchema(tableName, schema));
  }
  return tablesInfo;
}

export async function checkTableExists(
  tableName: string,
  schema = 'main',
): Promise<boolean> {
  const {conn} = await getDuckDb();
  const res = await conn.query(
    `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${tableName}'`,
  );
  return getColValAsNumber(res) > 0;
}

export async function dropAllTables(schema?: string): Promise<void> {
  try {
    const {conn} = await getDuckDb();
    if (schema && schema !== 'main') {
      await conn.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } else {
      const res = await conn.query(
        `SELECT table_name, table_schema, table_type FROM information_schema.tables${
          schema ? ` WHERE table_schema = '${schema}'` : ''
        }`,
      );
      const schemasCol = res.getChild('table_schema');
      const tableNamesCol = res.getChild('table_name');
      const tableTypesCol = res.getChild('table_type');
      for (let i = 0; i < res.numRows; i++) {
        try {
          const schemaName = schemasCol?.get(i);
          const tableName = tableNamesCol?.get(i);
          const tableType = tableTypesCol?.get(i);
          if (tableName) {
            const query = `DROP ${
              tableType === 'VIEW' ? 'VIEW' : 'TABLE'
            } IF EXISTS ${schemaName}.${tableName}`;
            await conn.query(query);
          }
        } catch (err) {
          console.error(err);
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
}

export async function dropTable(tableName: string): Promise<void> {
  const {conn} = await getDuckDb();
  await conn.query(`DROP TABLE IF EXISTS ${tableName};`);
}

export async function dropFile(fname: string): Promise<void> {
  const {db} = await getDuckDb();
  db.dropFile(fname);
}

export async function dropAllFiles(): Promise<void> {
  const {db} = await getDuckDb();
  db.dropFiles();
}
