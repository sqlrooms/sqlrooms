import * as duckdb from '@duckdb/duckdb-wasm';
import * as arrow from 'apache-arrow';
import {DataTable, TableColumn, DuckDbConnector} from './types';
import {useState, useEffect} from 'react';
import {WasmDuckDbConnector} from './WasmDuckDbConnector';

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

// Singleton for backward compatibility
let duckConn: DuckDb;
let initialize: Promise<DuckDb> | undefined;

// Global singleton connector instance for backward compatibility
let globalConnector: WasmDuckDbConnector | null = null;

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
 * Get the global DuckDB connector (creates one if it doesn't exist)
 *
 * @returns A promise that resolves to the global DuckDB connector
 */
export async function getGlobalDuckDbConnector(): Promise<DuckDbConnector> {
  if (!globalConnector) {
    globalConnector = new WasmDuckDbConnector();
    await globalConnector.initialize();
  }
  return globalConnector;
}

/**
 * @deprecated getDuckConn is deprecated, use getDuckDb instead
 */
export const getDuckConn = getDuckDb;

/**
 * @deprecated Use getGlobalDuckDbConnector() or the connector from ProjectStore instead
 */
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
    // Initialize the global connector
    const connector = (await getGlobalDuckDbConnector()) as WasmDuckDbConnector;

    // For backward compatibility, expose the internal implementation details
    duckConn = {
      db: connector.getDb(),
      conn: connector.getConn(),
      worker: connector.getWorker(),
    };

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

/**
 * @deprecated Use the connector from ProjectStore instead
 */
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

// All of the following functions are now just wrappers around the connector API
// They're maintained for backward compatibility

/**
 * @deprecated Use connector.getTables() instead
 */
export async function getDuckTables(schema = 'main'): Promise<string[]> {
  const connector = await getGlobalDuckDbConnector();
  return connector.getTables(schema);
}

/**
 * @deprecated Use connector.getTableSchema() instead
 */
export async function getDuckTableSchema(
  tableName: string,
  schema = 'main',
): Promise<DataTable> {
  const connector = await getGlobalDuckDbConnector();
  return connector.getTableSchema(tableName, schema);
}

/**
 * @deprecated Use connector.getTableSchemas() instead
 */
export async function getDuckTableSchemas(
  schema = 'main',
): Promise<DataTable[]> {
  const connector = await getGlobalDuckDbConnector();
  return connector.getTableSchemas(schema);
}

/**
 * @deprecated Use connector.tableExists() instead
 */
export async function checkTableExists(
  tableName: string,
  schema = 'main',
): Promise<boolean> {
  const connector = await getGlobalDuckDbConnector();
  return connector.tableExists(tableName, schema);
}

/**
 * @deprecated Use connector.dropTable() instead
 */
export async function dropAllTables(schema?: string): Promise<void> {
  const connector = await getGlobalDuckDbConnector();
  const tables = await connector.getTables(schema);
  for (const tableName of tables) {
    await connector.dropTable(tableName);
  }
}

/**
 * @deprecated Use connector.dropTable() instead
 */
export async function dropTable(tableName: string): Promise<void> {
  const connector = await getGlobalDuckDbConnector();
  await connector.dropTable(tableName);
}

/**
 * @deprecated Use connector.dropFile() instead
 */
export async function dropFile(fname: string): Promise<void> {
  const connector = await getGlobalDuckDbConnector();
  await connector.dropFile(fname);
}

/**
 * @deprecated Use connector.dropFile() for each file instead
 */
export async function dropAllFiles(): Promise<void> {
  const {db} = await getDuckDb();
  db.dropFiles();
}
