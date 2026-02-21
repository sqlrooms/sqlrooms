/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {DuckDBAccessMode} from '@duckdb/duckdb-wasm';
export type {DuckDBBundles, DuckDBConfig} from '@duckdb/duckdb-wasm';

export {
  isSpatialLoadFileOptions,
  LoadFileOptions,
  SpatialLoadFileOptions,
} from '@sqlrooms/room-config';

export {
  createDuckDbConnector,
  createWasmDuckDbConnector,
  isWasmDuckDbConnector,
  type DuckDbConnectorOptions,
  type DuckDbConnectorType,
  type WasmDuckDbConnector,
} from './connectors/createDuckDbConnector';

export {
  createWebSocketDuckDbConnector,
  type WebSocketDuckDbConnector,
  type WebSocketDuckDbConnectorOptions,
} from './connectors/WebSocketDuckDbConnector';

export {
  createDuckDbSlice,
  useStoreWithDuckDb,
  type CreateDuckDbSliceProps,
  type DuckDbSliceState,
  type SchemaAndDatabase,
} from './DuckDbSlice';

export {useExportToCsv} from './exportToCsv';

export {useDuckDb} from './useDuckDb';

export {
  useDuckDbQuery,
  useSql,
  type DuckDbQueryResult,
  type UseSqlQueryResult,
} from './useSql';

// Re-export from @sqlrooms/duckdb-core
export {
  arrowTableToJson,
  createBaseDuckDbConnector,
  createDbSchemaTrees,
  createTypedRowAccessor,
  escapeId,
  escapeVal,
  getArrowColumnTypeCategory,
  getColValAsNumber,
  getDuckDbTypeCategory,
  getSqlErrorWithPointer,
  isNumericDuckType,
  isQualifiedTableName,
  joinStatements,
  literalToSQL,
  load,
  loadCSV,
  loadJSON,
  loadObjects,
  loadParquet,
  loadSpatial,
  makeLimitQuery,
  makeQualifiedTableName,
  sanitizeQuery,
  separateLastStatement,
  splitSqlStatements,
  sqlFrom,
  type BaseDuckDbConnectorImpl,
  type BaseDuckDbConnectorOptions,
  type ColumnNodeObject,
  type ColumnTypeCategory,
  type DatabaseNodeObject,
  type DataTable,
  type DbSchemaNode,
  type DuckDbConnector,
  type NodeObject,
  type QualifiedTableName,
  type QueryHandle,
  type QueryOptions,
  type SchemaNodeObject,
  type SeparatedStatements,
  type TableColumn,
  type TableNodeObject,
  type TypedRowAccessor,
} from '@sqlrooms/duckdb-core';
