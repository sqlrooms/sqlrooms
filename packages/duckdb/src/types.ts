export type TableColumn = {
  name: string;
  type: string;
};

export type DataTable = {
  tableName: string;
  columns: TableColumn[];
  rowCount?: number;
  inputFileName?: string;
};
