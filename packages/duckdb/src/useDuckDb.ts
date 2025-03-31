import * as duckdb from '@duckdb/duckdb-wasm';
import {useStoreWithDuckDb} from './DuckDbSlice';
import {DuckDbConnector} from './connectors/DuckDbConnector';

/**
 * @deprecated DuckConn is deprecated, use DuckDb instead
 */
export type DuckConn = DuckDb;

export type DuckDb = {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
  worker: Worker;
};

export function useDuckDb(): DuckDbConnector {
  const connector = useStoreWithDuckDb((state) => state.db.connector);
  return connector;
}
