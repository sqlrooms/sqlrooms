/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {createHttpDbBridge} from './bridge';
export {createCoreDuckDbConnection} from './connectors/duckdb';
export {createDbSlice, useStoreWithDb} from './DbSlice';
export {getCoreDuckDbConnectionId, isCoreDuckDbConnection} from './helpers';
export {DbConnection, RuntimeSupport, DbEngineId} from './types';
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
  DbConnector,
  DbConnectorCapabilities,
  DbRootState,
  DbSliceConfig,
  DbSliceState,
  QueryExecutionRequest,
  QueryExecutionResult,
} from './types';

export type {
  FunctionSuggestion,
  GroupedFunctionSuggestion,
} from '@sqlrooms/duckdb-core';

export {useSql} from '@sqlrooms/duckdb';
export * from '@sqlrooms/duckdb-core';
