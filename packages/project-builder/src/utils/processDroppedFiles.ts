import {DuckDBDataProtocol} from '@duckdb/duckdb-wasm';
import {
  DuckDbConnector,
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
import {ProjectFileInfo} from '../types';

export async function processDroppedFile({
  file,
  existingTables,
  duckDbConnector,
}: {
  file: File;
  existingTables?: string[];
  duckDbConnector: DuckDbConnector;
}): Promise<{tableName: string; fileInfo: ProjectFileInfo}> {
  const tableName = convertToUniqueColumnOrTableName(
    file.name,
    existingTables ?? (await duckDbConnector.getTables()),
  );
  const {ext} = splitFilePath(file.name);
  const duckdbFileName = `${genRandomStr(6).toLowerCase()}.${ext}`;

  // Load the file using the connector
  const {rowCount} = await duckDbConnector.loadFile(file, duckdbFileName);

  if (rowCount > 0) {
    return {
      tableName,
      fileInfo: {
        duckdbFileName,
        pathname: file.name,
        size: file.size,
        file,
        numRows: rowCount,
      },
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
    duckDbConnector,
  }: {
    onError: (message: string) => void;
    onLoadingStatusChange: (status: string | undefined) => void;
    setTableNames: (tableNames: string[]) => void;
    setAddedFiles: (files: ProjectFileInfo[]) => void;
    duckDbConnector: DuckDbConnector;
  },
): Promise<void> {
  const filesToAdd: ProjectFileInfo[] = [];
  const tableNames: string[] = [];
  let lastFileName: string | null = null;
  try {
    const existingTables = await duckDbConnector.getTables();
    for (const file of droppedFiles) {
      onLoadingStatusChange(`Loading file "${file.name}"…`);
      lastFileName = file.name;

      try {
        const result = await processDroppedFile({
          file,
          existingTables,
          duckDbConnector,
        });
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
