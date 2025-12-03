import {DuckDbConnector} from '@sqlrooms/duckdb-core';
import {useStoreWithDuckDb} from './DuckDbSlice';

export function useDuckDb(): DuckDbConnector {
  const connector = useStoreWithDuckDb((state) => state.db.connector);
  return connector;
}
