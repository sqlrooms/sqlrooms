export type TableColumn = {
  name: string;
  type: string;
};

export type DataTable = {
  database: string;
  tableName: string;
  schema: string;
  columns: TableColumn[];
  rowCount?: number;
  inputFileName?: string;
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

export type DbSchemaNode = {
  key: string;
  object: NodeData;
  children?: DbSchemaNode[];
  isInitialOpen?: boolean;
};

export type NodeData =
  | ColumnNodeData
  | TableNodeData
  | SchemaNodeData
  | DatabaseNodeData;

type BaseNodeData = {
  name: string;
};

export type ColumnNodeData = BaseNodeData & {
  type: 'column';
  columnType: string;
  columnTypeCategory?: ColumnTypeCategory;
};

export type TableNodeData = BaseNodeData & {
  type: 'table';
  schema: string;
  database: string;
};

export type SchemaNodeData = BaseNodeData & {
  type: 'schema';
};

export type DatabaseNodeData = BaseNodeData & {
  type: 'database';
};
