import type {SQLNamespace} from '@codemirror/lang-sql';
import type {DataTable} from '@sqlrooms/duckdb';

/** Converts SQLRooms DataTable[] to CodeMirror SQLNamespace format for autocompletion */
export function convertToSQLNamespace(tables: DataTable[]): SQLNamespace {
  const namespace: SQLNamespace = {};

  for (const table of tables) {
    namespace[table.table.table] = table.columns.map((col) => col.name);
  }

  return namespace;
}
