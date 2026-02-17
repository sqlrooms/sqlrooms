/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {createDbSlice, useStoreWithDb} from './DbSlice';
export {
  createCoreDuckDbConnection,
  isCoreDuckDbConnection,
} from './connectors/duckdb';
export {createHttpDbBridge} from './bridge';
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
