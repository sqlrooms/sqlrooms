import {QualifiedTableName} from './duckdb-utils';

export type TableColumn = {
  name: string;
  type: string;
};

export type DataTable = {
  table: QualifiedTableName;
  isView: boolean;
  /** @deprecated Use table.database instead */
  database?: string;
  /** @deprecated Use table.schema instead */
  schema: string;
  /** @deprecated Use table.table instead */
  tableName: string;
  columns: TableColumn[];
  rowCount?: number;
  inputFileName?: string;
  sql?: string;
  comment?: string;
};
export type ColumnTypeCategory =
  | 'number'
  | 'string'
  | 'datetime'
  | 'boolean'
  | 'binary'
  | 'json'
  | 'struct'
  | 'geometry';

export type DbSchemaNode<T extends NodeObject = NodeObject> = {
  key: string;
  object: T;
  children?: DbSchemaNode[];
  isInitialOpen?: boolean;
};

export type NodeObject =
  | ColumnNodeObject
  | TableNodeObject
  | SchemaNodeObject
  | DatabaseNodeObject;

type BaseNodeObject = {
  name: string;
};

export type ColumnNodeObject = BaseNodeObject & {
  type: 'column';
  columnType: string;
  columnTypeCategory?: ColumnTypeCategory;
};

export type TableNodeObject = BaseNodeObject & {
  type: 'table';
} & DataTable;

export type SchemaNodeObject = BaseNodeObject & {
  type: 'schema';
};

export type DatabaseNodeObject = BaseNodeObject & {
  type: 'database';
};
