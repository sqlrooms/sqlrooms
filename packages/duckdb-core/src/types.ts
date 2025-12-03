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
