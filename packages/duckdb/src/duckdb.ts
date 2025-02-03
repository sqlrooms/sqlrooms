import {DuckDBDataProtocol} from '@duckdb/duckdb-wasm';
import {escapeVal, getColValAsNumber, getDuckDb} from './useDuckDb';
import * as arrow from 'apache-arrow';
import {sqlFrom} from './sql-from';

/**
 * Create a table from a query.
 * @param tableName - The name of the table to create.
 * @param query - The query to create the table from.
 * @returns The table that was created.
 */
export async function createTableFromQuery(tableName: string, query: string) {
  const {conn} = await getDuckDb();
  const rowCount = getColValAsNumber(
    await conn.query(
      `CREATE OR REPLACE TABLE main.${tableName} AS (
        ${query}
      )`,
    ),
  );
  return {tableName, rowCount};
}

/**
 * Create a view from a registered file.
 * @param filePath - The path to the file to create the view from.
 * @param schema - The schema to create the view in.
 * @param tableName - The name of the table to create.
 * @param opts - The options to create the view with.
 * @returns The view that was created.
 */
export async function createViewFromRegisteredFile(
  filePath: string,
  schema: string,
  tableName: string,
  opts?: {
    // columnSpecs?: ColumnSpec[];
    mode: 'table' | 'view';
  },
): Promise<{tableName: string; rowCount: number}> {
  const {mode = 'table'} = opts ?? {};
  const {conn} = await getDuckDb();
  const fileNameLower = filePath.toLowerCase();
  const quotedFileName = escapeVal(filePath);
  const readFileQuery =
    fileNameLower.endsWith('.json') ||
    fileNameLower.endsWith('.geojson') ||
    fileNameLower.endsWith('.ndjson')
      ? `read_json_auto(${quotedFileName}, maximum_object_size=104857600)` // 100MB
      : fileNameLower.endsWith('.parquet')
        ? `parquet_scan(${quotedFileName})`
        : fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.tsv')
          ? `read_csv(${quotedFileName}, SAMPLE_SIZE=-1, AUTO_DETECT=TRUE)`
          : quotedFileName;
  // TODO: tableName generate
  const rowCount = getColValAsNumber(
    await conn.query(
      `CREATE OR REPLACE ${mode} ${schema}.${tableName} AS
          SELECT * FROM ${readFileQuery}`,
    ),
  );
  // }
  return {tableName, rowCount};
}

/**
 * Create a view from a file.
 * @param filePath - The path to the file to create the view from.
 * @param schema - The schema to create the view in.
 * @param tableName - The name of the table to create.
 * @param file - The file to create the view from.
 */
export async function createViewFromFile(
  filePath: string,
  schema: string,
  tableName: string,
  file: File | Uint8Array,
): Promise<{tableName: string; rowCount: number}> {
  const duckConn = await getDuckDb();

  await duckConn.db.dropFile(filePath);
  if (file instanceof File) {
    await duckConn.db.registerFileHandle(
      filePath,
      file,
      DuckDBDataProtocol.BROWSER_FILEREADER,
      true,
    );
  } else {
    await duckConn.db.registerFileBuffer(filePath, file);
  }

  return createViewFromRegisteredFile(filePath, schema, tableName);
}

/**
 * Create a table from an Arrow table.
 * @param tableName - The name of the table to create.
 * @param arrowTable - The Arrow table to create the table from.
 */
export async function createTableFromArrowTable(
  tableName: string,
  data: arrow.Table,
) {
  const {conn} = await getDuckDb();
  await conn.insertArrowTable(data, {name: tableName});
}

/**
 * Create a table from an array of objects.
 * @param tableName - The name of the table to create.
 * @param data - The array of objects to create the table from.
 */
export async function createTableFromObjects(
  tableName: string,
  data: Record<string, unknown>[],
) {
  const {conn} = await getDuckDb();
  const query = sqlFrom(data);
  await conn.query(`CREATE OR REPLACE TABLE ${tableName} AS ${query}`);
}
