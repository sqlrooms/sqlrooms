export type TableColumn = {
  name: string;
  type: string;
};

export type DataTable = {
  schema?: string;
  tableName: string;
  columns: TableColumn[];
  rowCount?: number;
  inputFileName?: string;
};
