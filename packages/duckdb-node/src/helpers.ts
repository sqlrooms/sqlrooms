import {
  DuckDBConnection,
  DuckDBResultReader,
  DuckDBTypeId,
  ResultReturnType,
  StatementType,
} from '@duckdb/node-api';
import {
  getRawSqlTableReference,
  literalToSQL,
  makeQualifiedTableName,
} from '@sqlrooms/duckdb-core';
import * as arrow from 'apache-arrow';

/**
 * Builds a qualified table name string from table name and optional schema.
 */
export function buildQualifiedName(tableName: string, schema?: string): string {
  return getRawSqlTableReference(
    makeQualifiedTableName({table: tableName, schema}),
  );
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
 * Statements that must run through DuckDB before the connection can serialize
 * results as Arrow. `nanoarrow` provides the `to_arrow_ipc()` table function.
 *
 * `INSTALL` is a no-op costing ~2ms once the extension is present, so this is
 * cheap to run on every connection; only the very first one reaches the
 * network.
 *
 * @see https://duckdb.org/community_extensions/extensions/nanoarrow.html
 */
export const ARROW_IPC_INIT_SQL = [
  'INSTALL nanoarrow FROM community',
  'LOAD nanoarrow',
].join(';\n');

/**
 * Number of statements in `sql` according to DuckDB's own parser, or `null`
 * when it does not parse.
 */
async function countStatements(
  conn: DuckDBConnection,
  sql: string,
): Promise<number | null> {
  try {
    return (await conn.extractStatements(sql)).count;
  } catch {
    return null;
  }
}

/**
 * Splits a multi-statement script into everything-but-the-last statement plus
 * the last one, or returns `null` when `sql` is a single statement.
 *
 * The split point is found by testing each `;` with DuckDB's own parser rather
 * than tokenizing here, so semicolons inside string literals, dollar-quoted
 * strings, and comments cannot produce a bad split. Parsing costs ~17µs, and
 * only candidate positions are tested.
 */
async function splitTrailingStatement(
  conn: DuckDBConnection,
  sql: string,
): Promise<{head: string; last: string} | null> {
  const total = await countStatements(conn, sql);
  if (total === null || total <= 1) {
    return null;
  }
  for (let i = sql.length - 1; i >= 0; i--) {
    if (sql[i] !== ';') continue;
    const head = sql.slice(0, i + 1);
    const last = sql.slice(i + 1);
    if (!last.trim()) continue;
    if (
      (await countStatements(conn, head)) === total - 1 &&
      (await countStatements(conn, last)) === 1
    ) {
      return {head, last};
    }
  }
  return null;
}

/** Whether `sql` is a single SELECT, per DuckDB's parser. */
async function isSelectStatement(
  conn: DuckDBConnection,
  sql: string,
): Promise<boolean> {
  try {
    const extracted = await conn.extractStatements(sql);
    if (extracted.count !== 1) return false;
    const prepared = await extracted.prepare(0);
    try {
      return prepared.statementType === StatementType.SELECT;
    } finally {
      prepared.destroySync();
    }
  } catch {
    return false;
  }
}

/** An Arrow table with no schema, for statements that return no result set. */
function emptyTable<T extends arrow.TypeMap = any>(): arrow.Table<T> {
  return arrow.tableFromArrays({}) as unknown as arrow.Table<T>;
}

/** Converts a materialized non-SELECT result to Arrow without dropping rows. */
function resultReaderToArrowTable<T extends arrow.TypeMap = any>(
  reader: DuckDBResultReader,
): arrow.Table<T> {
  const columns = reader.getColumnsJS();
  const vectors: Record<string, arrow.Vector> = {};
  for (let i = 0; i < reader.columnCount; i++) {
    const type =
      reader.columnTypeId(i) === DuckDBTypeId.BLOB
        ? new arrow.Binary()
        : undefined;
    const values = columns[i] ?? [];
    vectors[reader.columnName(i)] = type
      ? arrow.vectorFromArray(values, type)
      : arrow.vectorFromArray(values);
  }
  return new arrow.Table(vectors) as unknown as arrow.Table<T>;
}

/**
 * Runs `sql` through `to_arrow_ipc()` and decodes the resulting Arrow IPC
 * buffers, so DuckDB itself performs the Arrow conversion and every type
 * round-trips exactly.
 *
 * Throws if `nanoarrow` is not loaded, or if `sql` is not a single statement
 * that can be wrapped as a subquery.
 */
async function queryToArrowTableViaIpc<T extends arrow.TypeMap = any>(
  conn: DuckDBConnection,
  sql: string,
): Promise<arrow.Table<T>> {
  // A statement terminator is valid at the top level but not inside the
  // parenthesized subquery passed to `to_arrow_ipc()`.
  const normalizedSql = sql.replace(/;(\s*)$/, '$1');
  const reader = await conn.runAndReadAll(
    `SELECT * FROM to_arrow_ipc((${normalizedSql}))`,
  );
  const buffers = reader.getColumnsJS()[0] as Uint8Array[] | undefined;
  if (!buffers?.length) {
    // A zero-row result emits no IPC message at all, so there is no schema to
    // decode.
    return emptyTable<T>();
  }
  return arrow.tableFromIPC(buffers) as unknown as arrow.Table<T>;
}

/** Runs one statement, returning its rows as Arrow (empty if it has none). */
async function runStatementToArrow<T extends arrow.TypeMap = any>(
  conn: DuckDBConnection,
  sql: string,
): Promise<arrow.Table<T>> {
  try {
    return await queryToArrowTableViaIpc<T>(conn, sql);
  } catch (error) {
    // `to_arrow_ipc()` only accepts a sub-selectable statement, so DDL, `SET`,
    // `PRAGMA` and friends fail to PARSE inside it — nothing has executed and
    // running it plainly below is safe. A SELECT reaching here failed for a
    // real reason, and swallowing that would silently return no rows, so
    // rethrow instead.
    if (await isSelectStatement(conn, sql)) {
      throw error;
    }
    const reader = await conn.runAndReadAll(sql);
    return reader.returnType === ResultReturnType.QUERY_RESULT
      ? resultReaderToArrowTable<T>(reader)
      : emptyTable<T>();
  }
}

/**
 * Converts a DuckDB query result to an Apache Arrow table.
 *
 * `@duckdb/node-api` exposes no Arrow API, so the conversion is delegated to
 * DuckDB itself through the `nanoarrow` extension's `to_arrow_ipc()` — see
 * {@link ARROW_IPC_INIT_SQL}, which the connector runs at initialization.
 * Rebuilding the table from JS values instead cannot represent every DuckDB
 * type: TIMESTAMP, DATE, BIGINT and DECIMAL all come back as strings, and
 * BLOB loses its bytes entirely.
 *
 * A multi-statement script (`SET ...; SELECT ...`) is executed statement by
 * statement, with the last one supplying the returned rows.
 *
 * @see https://github.com/duckdb/duckdb-node-neo/issues/45
 */
export async function queryToArrowTable<T extends arrow.TypeMap = any>(
  conn: DuckDBConnection,
  sql: string,
): Promise<arrow.Table<T>> {
  const split = await splitTrailingStatement(conn, sql);
  if (!split) {
    return runStatementToArrow<T>(conn, sql);
  }
  await conn.run(split.head);
  return runStatementToArrow<T>(conn, split.last);
}
