export {createTypedRowAccessor} from './typedRowAccessor';
export type {TypedRowAccessor} from './typedRowAccessor';

export {
  createBaseDuckDbConnector,
  type BaseDuckDbConnectorOptions,
  type BaseDuckDbConnectorImpl,
} from './BaseDuckDbConnector';

export {
  literalToSQL,
  sqlFrom,
  load,
  loadCSV,
  loadJSON,
  loadParquet,
  loadSpatial,
  loadObjects,
} from './load/load';

export {
  type QueryOptions,
  type QueryHandle,
  type DuckDbConnector,
} from './DuckDbConnector';

export {arrowTableToJson} from './arrow-utils';

export {
  isQualifiedTableName,
  makeQualifiedTableName,
  getTableNameFromQualified,
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
} from './duckdb-utils';

export {
  getDuckDbTypeCategory,
  getArrowColumnTypeCategory,
  type ColumnTypeCategory,
} from './schema-tree/typeCategories';

export {createDbSchemaTrees} from './schema-tree/schemaTree';
export {
  getAllTablesFromSchemaTrees,
  findTableInSchemaTrees,
} from './schema-tree/schemaTreeUtils';

export {
  type DbSchemaNode,
  type NodeObject,
  type ColumnNodeObject,
  type TableNodeObject,
  type SchemaNodeObject,
  type DatabaseNodeObject,
  type SchemaWithTables,
} from './schema-tree/types';

export {type TableColumn, type DataTable} from './types';

export {getFunctionSuggestions} from './get-function-suggestions';
export {getFunctionDocumentation} from './get-function-documentation';
export {
  type FunctionSuggestion,
  type GroupedFunctionSuggestion,
} from './duckdb-function-utils';
