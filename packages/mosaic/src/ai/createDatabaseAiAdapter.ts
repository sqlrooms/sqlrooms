import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import type {AiStore} from './types';
import type {DatabaseAiAdapter} from './database-types';

/**
 * Creates a database AI adapter backed by the mounted DuckDB slice.
 */
export function createDuckDbDatabaseAiAdapter<TState extends DuckDbSliceState>(
  store: AiStore<TState>,
): DatabaseAiAdapter {
  return {
    getTables: () => store.getState().db.tables,
    findTable: (tableName) => store.getState().db.findTable(tableName),
  };
}
