/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {createHttpDbBridge} from './bridge';
export {createCoreDuckDbConnection} from './connectors/duckdb';
export {createDbSlice, useStoreWithDb} from './DbSlice';
export {getCoreDuckDbConnectionId, isCoreDuckDbConnection} from './helpers';
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

export type {
  FunctionSuggestion,
  GroupedFunctionSuggestion,
} from '@sqlrooms/duckdb-core';

export {useSql} from '@sqlrooms/duckdb';
export * from '@sqlrooms/duckdb-core';
