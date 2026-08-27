import {
  DuckDBConnection,
  DuckDBResultReader,
  ResultReturnType,
  StatementType,
} from '@duckdb/node-api';
import {
  getRawSqlTableReference,
  joinStatements,
  literalToSQL,
  makeQualifiedTableName,
  splitSqlStatements,
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
 * Splits SQL with the shared DuckDB-aware lexer and confirms its statement
 * count with DuckDB's own parser before any split statements are executed.
 *
 * Returns `null` when the input does not parse or the two implementations
 * disagree, so malformed or newly introduced syntax is passed to DuckDB whole.
 */
async function splitValidatedStatements(
  conn: DuckDBConnection,
  sql: string,
): Promise<string[] | null> {
  const statements = splitSqlStatements(sql, {removeComments: false});
  const total = await countStatements(conn, sql);
  return total === statements.length ? statements : null;
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

let nextResultTableId = 0;

/** Quotes a DuckDB identifier. */
function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

/**
 * Converts a materialized non-SELECT result to Arrow without losing its
 * declared DuckDB types.
 *
 * The native result values are copied through a temporary table, then that
 * table is serialized by `to_arrow_ipc()`. This keeps the fallback path on the
 * same type-exact conversion mechanism as ordinary SELECT results.
 */
async function resultReaderToArrowTable<T extends arrow.TypeMap = any>(
  conn: DuckDBConnection,
  reader: DuckDBResultReader,
): Promise<arrow.Table<T>> {
  if (reader.columnCount === 0 || reader.currentRowCount === 0) {
    return emptyTable<T>();
  }

  const tableName = `__sqlrooms_arrow_result_${nextResultTableId++}`;
  const columnTypes = reader.columnTypes();
  const columnDefinitions = columnTypes
    .map((type, i) => `c${i} ${type}`)
    .join(', ');
  await conn.run(`CREATE TEMP TABLE ${tableName} (${columnDefinitions})`);

  let appender: Awaited<ReturnType<DuckDBConnection['createAppender']>> | null =
    null;
  try {
    appender = await conn.createAppender(tableName);
    const columns = reader.getColumns();
    for (let row = 0; row < reader.currentRowCount; row++) {
      for (let column = 0; column < reader.columnCount; column++) {
        appender.appendValue(
          columns[column]?.[row] ?? null,
          columnTypes[column],
        );
      }
      appender.endRow();
    }
    appender.closeSync();
    appender = null;

    const projection = reader
      .columnNames()
      .map((name, i) => `c${i} AS ${quoteIdentifier(name)}`)
      .join(', ');
    return await queryToArrowTableViaIpc<T>(
      conn,
      `SELECT ${projection} FROM ${tableName}`,
    );
  } finally {
    appender?.closeSync();
    await conn.run(`DROP TABLE IF EXISTS ${tableName}`);
  }
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
  const reader = await conn.runAndReadAll(
    `SELECT * FROM to_arrow_ipc((${sql}\n))`,
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
      ? resultReaderToArrowTable<T>(conn, reader)
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
  const statements = await splitValidatedStatements(conn, sql);
  if (!statements || statements.length === 0) {
    return runStatementToArrow<T>(conn, sql);
  }

  const lastStatement = statements.at(-1)!;
  if (statements.length > 1) {
    await conn.run(joinStatements(statements.slice(0, -2), statements.at(-2)!));
  }
  return runStatementToArrow<T>(conn, lastStatement);
}
