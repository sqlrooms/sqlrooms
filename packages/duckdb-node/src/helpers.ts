import {DuckDBConnection} from '@duckdb/node-api';
import {literalToSQL, makeQualifiedTableName} from '@sqlrooms/duckdb-core';
import * as arrow from 'apache-arrow';

/**
 * Builds a qualified table name string from table name and optional schema.
 */
export function buildQualifiedName(tableName: string, schema?: string): string {
  return makeQualifiedTableName({table: tableName, schema}).toString();
}

/**
 * Converts a BigInt to a safe JavaScript number or string.
 * Returns number if within safe range, otherwise string.
 */
function convertBigInt(value: bigint): number | string {
  if (value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) {
    return Number(value);
  }
  return value.toString();
}

/**
 * Converts an Arrow table to an array of row objects.
 */
export function arrowTableToRows(
  table: arrow.Table,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < table.numRows; i++) {
    const row: Record<string, unknown> = {};
    for (const field of table.schema.fields) {
      const col = table.getChild(field.name);
      row[field.name] = col?.get(i);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Converts a value to SQL literal, with bigint support.
 */
function toSqlLiteral(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return literalToSQL(value);
}

/**
 * Converts an array of objects to a SQL CREATE TABLE AS SELECT statement.
 */
export function objectsToCreateTableSql(
  data: Record<string, unknown>[],
  qualifiedName: string,
): string {
  const columns = Object.keys(data[0]!);
  const columnList = columns.map((c) => `"${c}"`).join(', ');

  const valueRows = data.map((row) => {
    const values = columns.map((col) => toSqlLiteral(row[col]));
    return `(${values.join(', ')})`;
  });

  return `CREATE OR REPLACE TABLE ${qualifiedName} (${columnList}) AS 
    SELECT * FROM (VALUES ${valueRows.join(', ')}) AS t(${columnList})`;
}

/**
 * Converts DuckDB query result to an Apache Arrow table.
 *
 * TODO: Remove this once duckdb-node-neo supports Arrow tables directly.
 * @see https://github.com/duckdb/duckdb-node-neo/issues/45
 */
export async function queryToArrowTable<T extends arrow.TypeMap = any>(
  conn: DuckDBConnection,
  sql: string,
): Promise<arrow.Table<T>> {
  const reader = await conn.runAndReadAll(sql);
  const columnNames = reader.columnNames();
  const columns = reader.getColumnsJson();

  if (columnNames.length === 0 || reader.currentRowCount === 0) {
    return arrow.tableFromArrays({}) as unknown as arrow.Table<T>;
  }

  // Build column name -> array mapping, converting BigInts for Arrow compatibility
  const columnsObject: Record<string, unknown[]> = {};
  for (let i = 0; i < columnNames.length; i++) {
    const name = columnNames[i] as string;
    const columnData = columns[i] ?? [];
    columnsObject[name] = (columnData as unknown[]).map((v) =>
      typeof v === 'bigint' ? convertBigInt(v) : v,
    );
  }

  return arrow.tableFromArrays(columnsObject) as unknown as arrow.Table<T>;
}
