import {DuckDBDataProtocol} from '@duckdb/duckdb-wasm';
import {escapeVal, getColValAsNumber, getDuckConn} from './useDuckConn';

// export function makeTableName(inputFileName: string): string {
//   return inputFileName.replace(/\.[^\.]*$/, '').replace(/\W/g, '_');
// }

export async function createTableFromQuery(tableName: string, query: string) {
  const {conn} = await getDuckConn();
  const rowCount = getColValAsNumber(
    await conn.query(
      `CREATE OR REPLACE TABLE main.${tableName} AS (
        ${query}
      )`,
    ),
  );
  return {tableName, rowCount};
}

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
  const {conn} = await getDuckConn();
  const fileNameLower = filePath.toLowerCase();
  // let rowCount: number;
  // if (fileNameLower.endsWith('.json')) {
  //   await conn.insertJSONFromPath(filePath, {schema, name: tableName});
  //   // TODO: for JSON we can use insertJSONFromPath https://github.com/duckdb/duckdb-wasm/issues/1262
  //   // fileNameLower.endsWith('.json') || fileNameLower.endsWith('.ndjson')
  //   // ? `read_json_auto(${escapeVal(fileName)})`
  //   rowCount = getColValAsNumber(
  //     await conn.query(`SELECT COUNT(*) FROM ${schema}.${tableName}`),
  //   );
  // } else {
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
  // const readFileQuery = fileNameLower.endsWith('.csv')
  //   ? `read_csv(${quotedFileName}, SAMPLE_SIZE=-1, AUTO_DETECT=TRUE)`
  //   : quotedFileName;

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

export async function createViewFromFile(
  filePath: string,
  schema: string,
  tableName: string,
  file: File | Uint8Array,
): Promise<{tableName: string; rowCount: number}> {
  const duckConn = await getDuckConn();

  // const fileName = file.name;
  // await duckConn.db.dropFile(fileName);
  // await duckConn.db.registerFileHandle(
  //   fileName,
  //   file,
  //   DuckDBDataProtocol.BROWSER_FILEREADER,
  //   true,
  // );

  // const tableName = makeTableName(fileName);
  // await duckConn.conn.query(`
  //     CREATE OR REPLACE VIEW ${tableName} AS SELECT * FROM '${fileName}'
  // `);

  //const fileName = file.name;
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

  // const res = await duckConn.conn.query(
  //   `SELECT count(*) FROM ${inputTableName}`,
  // );
  // const inputRowCount = getColValAsNumber(res, 0);
  // const tableMeta = await duckConn.conn.query(
  //   `DESCRIBE TABLE ${inputTableName}`,
  // );
  // const inputTableFields = Array.from(tableMeta).map((row) => ({
  //   name: String(row?.column_name),
  //   type: String(row?.column_type),
  // }));

  // const nextResult: DataTable = {
  //   inputFileName,
  //   tableName: inputTableName,
  //   rowCount: inputRowCount,
  //   // outputRowCount: undefined,
  //   columns: inputTableFields,
  // };
  // // setResult(nextResult);
  // return nextResult;
}

// async function createViewFromFile2(
//   file: File,
//   duckConn: DuckConn,
//   onTableCreated: (
//     inputTableName: string,
//     result: CreateTableDropzoneResult,
//   ) => void,
//   onError: (status:'error', message: string) => void,
// ) {
//   try {
//     const inputFileName = file.name;
//     await duckConn.db.dropFile(inputFileName);
//     await duckConn.db.registerFileHandle(
//       inputFileName,
//       file,
//       DuckDBDataProtocol.BROWSER_FILEREADER,
//       true,
//     );

//     const inputTableName = genRandomStr(10, inputFileName).toLowerCase();
//     await duckConn.conn.query(`DROP TABLE IF EXISTS ${inputTableName}`);
//     const readFileQuery = inputFileName.endsWith('.parquet')
//       ? `parquet_scan(${escapeVal(inputFileName)})`
//       : `read_csv(${escapeVal(
//           inputFileName,
//         )}, SAMPLE_SIZE=-1, AUTO_DETECT=TRUE)`;
//     await duckConn.conn.query(
//       `CREATE TABLE ${inputTableName} AS
//             SELECT * FROM ${readFileQuery}`,
//     );

//     const res = await duckConn.conn.query(
//       `SELECT count(*) FROM ${inputTableName}`,
//     );
//     const inputRowCount = getColValAsNumber(res, 0);
//     const tableMeta = await duckConn.conn.query(
//       `DESCRIBE TABLE ${inputTableName}`,
//     );
//     const inputTableFields = Array.from(tableMeta).map((row) => ({
//       name: String(row?.column_name),
//       type: String(row?.column_type),
//     }));

//     const nextResult: CreateTableDropzoneResult = {
//       inputFileName,
//       inputTableName,
//       inputRowCount,
//       // outputRowCount: undefined,
//       inputTableFields,
//       columns: {},
//     };
//     // setResult(nextResult);
//     onTableCreated(inputTableName, nextResult);
//   } catch (e) {
//     console.error(e);
//     onError(e instanceof Error ? e.message : String(e));
//   }
// }

// async function maybeDropTable(
//   value: CreateTableDropzoneResult,
//   duckConn: DuckConn,
// ) {
//   const {inputFileName, inputTableName} = value || {};
//   if (inputFileName) {
//     await duckConn.db.dropFile(inputFileName);
//   }
//   if (inputTableName) {
//     await duckConn.conn.query(`DROP TABLE IF EXISTS ${inputTableName};`);
//   }
// }
