import * as duckdb from '@duckdb/duckdb-wasm';
import {useStoreWithDuckDb} from './DuckDbSlice';
import {DuckDbConnector} from './connectors/DuckDbConnector';

/**
 * @deprecated
 */
export type DuckConn = DuckDb;

/**
 * @deprecated
 */
export type DuckDb = {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
  worker: Worker;
};

export function useDuckDb(): DuckDbConnector {
  const connector = useStoreWithDuckDb((state) => state.db.connector);
  return connector;
}
