import * as duckdb from '@duckdb/duckdb-wasm';

/**
 * @deprecated DuckConn is deprecated, use DuckDb instead
 */
export type DuckConn = DuckDb;

export type DuckDb = {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
  worker: Worker;
};

export function useDuckDb(): DuckDb {}
