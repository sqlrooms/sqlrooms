import {DataTable} from '../types';
import {ColumnTypeCategory} from './typeCategories';

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
