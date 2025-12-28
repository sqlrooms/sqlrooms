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
  type WasmDuckDbConnector,
  type DuckDbConnectorType,
  type DuckDbConnectorOptions,
} from './connectors/createDuckDbConnector';

export {
  createWebSocketDuckDbConnector,
  type WebSocketDuckDbConnectorOptions,
  type WebSocketDuckDbConnector,
} from './connectors/WebSocketDuckDbConnector';

export {
  createDuckDbSlice,
  useStoreWithDuckDb,
  type DuckDbSliceState,
  type SchemaAndDatabase,
} from './DuckDbSlice';

export {useExportToCsv} from './exportToCsv';

export {useDuckDb} from './useDuckDb';

export {
  useSql,
  useDuckDbQuery,
  type UseSqlQueryResult,
  type DuckDbQueryResult,
} from './useSql';

// Re-export from @sqlrooms/duckdb-core
export {
  createTypedRowAccessor,
  type TypedRowAccessor,
  createBaseDuckDbConnector,
  type BaseDuckDbConnectorOptions,
  type BaseDuckDbConnectorImpl,
  literalToSQL,
  sqlFrom,
  load,
  loadCSV,
  loadJSON,
  loadParquet,
  loadSpatial,
  loadObjects,
  type QueryOptions,
  type QueryHandle,
  type DuckDbConnector,
  arrowTableToJson,
  isQualifiedTableName,
  makeQualifiedTableName,
  escapeVal,
  escapeId,
  isNumericDuckType,
  getColValAsNumber,
  getSqlErrorWithPointer,
  splitSqlStatements,
  sanitizeQuery,
  makeLimitQuery,
  separateLastStatement,
  joinStatements,
  type QualifiedTableName,
  type SeparatedStatements,
  getDuckDbTypeCategory,
  getArrowColumnTypeCategory,
  type ColumnTypeCategory,
  createDbSchemaTrees,
  type DbSchemaNode,
  type NodeObject,
  type ColumnNodeObject,
  type TableNodeObject,
  type SchemaNodeObject,
  type DatabaseNodeObject,
  type TableColumn,
  type DataTable,
} from '@sqlrooms/duckdb-core';
