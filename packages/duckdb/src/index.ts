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
  type WasmDuckDbConnectorOptions,
} from './connectors/createDuckDbConnector';

export {
  createWebSocketDuckDbConnector,
  type WebSocketDuckDbConnector,
  type WebSocketDuckDbConnectorOptions,
} from './connectors/WebSocketDuckDbConnector';

export {
  createDuckDbSlice,
  useStoreWithDuckDb,
  createDefaultLoadTableSchemasFilter,
  defaultLoadSchemaCatalogFilter,
  defaultLoadTableSchemasFilter,
  type CreateDuckDbSliceProps,
  type DuckDbSliceState,
} from './DuckDbSlice';

export {
  loadSchemaCatalog,
  type LoadSchemaCatalogFilterFunction,
  type LoadSchemaCatalogOptions,
  type LoadTableSchemasFilterFunction,
  type SchemaCatalogFilterEntry,
  type LoadTableSchemasFilter,
  type LoadTableSchemasOptions,
} from './loadTableSchemas';

export {useExportToCsv, type UseExportToCsvReturn} from './use-export-to-csv';

export {
  useCopyAsTsv,
  type CopyAsTsvOptions,
  type CopyAsTsvResult,
  type UseCopyAsTsvReturn,
} from './use-copy-as-tsv';

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
  getFunctionSuggestions,
  getFunctionDocumentation,
  type BaseDuckDbConnectorImpl,
  type BaseDuckDbConnectorOptions,
  type ColumnNodeObject,
  type ColumnTypeCategory,
  type DatabaseNodeObject,
  type DataTable,
  type DbSchemaNode,
  type DuckDbConnector,
  type FunctionSuggestion,
  type GroupedFunctionSuggestion,
  type NodeObject,
  type QualifiedTableName,
  type QueryHandle,
  type QueryOptions,
  type SchemaNodeObject,
  type SchemaWithTables,
  type SeparatedStatements,
  type TableColumn,
  type TableNodeObject,
  type TypedRowAccessor,
} from '@sqlrooms/duckdb-core';
