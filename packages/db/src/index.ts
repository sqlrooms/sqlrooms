/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {createHttpDbBridge} from './bridge';
export {
  createCoreDuckDbConnection,
  isCoreDuckDbConnection,
} from './connectors/duckdb';
export {createDbSlice, useStoreWithDb} from './DbSlice';
export type {
  CatalogColumn,
  CatalogDatabase,
  CatalogEntry,
  CatalogSchema,
  CatalogTable,
  CatalogTableDetails,
  CoreMaterializationConfig,
  CoreMaterializationStrategy,
  DbBridge,
  DbConnection,
  DbConnector,
  DbConnectorCapabilities,
  DbEngineId,
  DbRootState,
  DbSliceConfig,
  DbSliceState,
  QueryExecutionRequest,
  QueryExecutionResult,
  RuntimeSupport,
} from './types';

export {useSql} from '@sqlrooms/duckdb';
export * from '@sqlrooms/duckdb-core';
