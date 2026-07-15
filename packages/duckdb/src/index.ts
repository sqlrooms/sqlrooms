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
  type WebSocketDuckDbConnectionStatus,
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
export {useDataTable} from './useDataTable';

export {
  useDuckDbQuery,
  useSql,
  type DuckDbQueryResult,
  type UseSqlQueryResult,
} from './useSql';

// Re-export from @sqlrooms/duckdb-core
export {
  arrowTableToJson,
  columnTypeCategoryToSelectorType,
  createBaseDuckDbConnector,
  createDbSchemaTrees,
  createTypedRowAccessor,
  escapeId,
  escapeVal,
  findTableInSchemaTrees,
  getAllTablesFromSchemaTrees,
  getArrowColumnTypeCategory,
  getColumnTypeCategory,
  getColValAsNumber,
  getDuckDbTypeCategory,
  getFullTableIdentity,
  getRawSqlTableReference,
  getSqlErrorWithPointer,
  getTableDisplayName,
  getTableIdentity,
  getUnqualifiedSqlIdentifier,
  isColumnCategorical,
  isColumnGeometry,
  isColumnNumeric,
  isColumnQuantitative,
  isColumnTemporal,
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
  parseFullTableIdentity,
  parseQualifiedSqlIdentifier,
  parseTableIdentity,
  parseTableIdentityToQualifiedName,
  quoteParsedRawSqlTableReference,
  quoteTableReference,
  resolveTableReference,
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
  type ColumnTypeLike,
  type DatabaseNodeObject,
  type DataTable,
  type DbSchemaNode,
  type DuckDbConnector,
  type FunctionSuggestion,
  type FullTableIdentity,
  type GroupedFunctionSuggestion,
  type NodeObject,
  type QualifiedTableName,
  type QueryHandle,
  type QueryOptions,
  type RawSqlTableReference,
  type ResolveTableReferenceResult,
  type SchemaNodeObject,
  type SchemaWithTables,
  type SeparatedStatements,
  type TableColumn,
  type TableIdentity,
  type TableNodeObject,
  type TypedRowAccessor,
} from '@sqlrooms/duckdb-core';
