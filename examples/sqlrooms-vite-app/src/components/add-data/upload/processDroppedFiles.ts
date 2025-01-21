import {DuckDBDataProtocol} from '@duckdb/duckdb-wasm';
import {
  escapeVal,
  getColValAsNumber,
  getDuckDb,
  getDuckTables,
} from '@sqlrooms/duckdb';
import {
  convertToUniqueColumnOrTableName,
  genRandomStr,
  splitFilePath,
} from '@sqlrooms/utils';
import {AddedFileInfo} from './UploadFilesPreview';

export async function processDroppedFile({
  file,
  existingTables,
}: {
  file: File;
  existingTables?: string[];
}): Promise<{tableName: string; fileInfo: AddedFileInfo}> {
  const {db} = await getDuckDb();
  const tableName = convertToUniqueColumnOrTableName(
    file.name,
    existingTables ?? (await getDuckTables()),
  );
  const {ext} = splitFilePath(file.name);
  const duckdbFileName = `${genRandomStr(6).toLowerCase()}.${ext}`;
  await db.registerFileHandle(
    duckdbFileName,
    file,
    DuckDBDataProtocol.BROWSER_FILEREADER,
    true,
  );
  const {conn} = await getDuckDb();
  let numRows = 0;
  try {
    numRows = getColValAsNumber(
      await conn.query(`SELECT COUNT(*) FROM ${escapeVal(duckdbFileName)}`),
    );
  } catch (err) {
    console.error(err);
    // do nothing
  }
  if (numRows > 0) {
    return {
      tableName,
      fileInfo: {duckdbFileName, filePath: file.name, file},
    };
  } else {
    throw new Error(`File "${file.name}" couldn't be loaded`);
  }
}

export async function processDroppedFiles(
  droppedFiles: File[],
  {
    onError,
    onLoadingStatusChange,
    setTableNames,
    setAddedFiles,
  }: {
    onError: (message: string) => void;
    onLoadingStatusChange: (status: string | undefined) => void;
    setTableNames: (tableNames: string[]) => void;
    setAddedFiles: (files: AddedFileInfo[]) => void;
  },
): Promise<void> {
  const filesToAdd: AddedFileInfo[] = [];
  const tableNames: string[] = [];
  let lastFileName: string | null = null;
  try {
    const existingTables = await getDuckTables();
    for (const file of droppedFiles) {
      onLoadingStatusChange(`Loading file "${file.name}"…`);
      lastFileName = file.name;

      try {
        const result = await processDroppedFile({file, existingTables});
        const {tableName, fileInfo} = result;
        tableNames.push(tableName);
        existingTables.push(tableName);
        filesToAdd.push(fileInfo);
      } catch (error) {
        onError((error as Error).message);
      }
    }
    setTableNames(tableNames);
    setAddedFiles(filesToAdd);
  } catch (e) {
    onError(`Couldn't create table from file "${lastFileName}"`);
    console.error(e);
  } finally {
    onLoadingStatusChange(undefined);
  }
}
