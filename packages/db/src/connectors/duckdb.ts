import type {DbConnection} from '../types';

export const CORE_DUCKDB_CONNECTION_ID = 'duckdb-core';

export function createCoreDuckDbConnection(
  overrides?: Partial<DbConnection>,
): DbConnection {
  return {
    id: CORE_DUCKDB_CONNECTION_ID,
    engineId: 'duckdb',
    title: 'Core DuckDB',
    runtimeSupport: 'both',
    requiresBridge: false,
    isCore: true,
    ...overrides,
  };
}

export function isCoreDuckDbConnection(connectionId: string): boolean {
  return connectionId === CORE_DUCKDB_CONNECTION_ID;
}
