import {
  PARQUET_UPLOAD_LIMIT_BYTES,
  SOURCE_FILE_LIMIT_BYTES,
} from './fileLimits';
import {isWasmDuckDbConnector} from '@sqlrooms/duckdb';
import type {WorkspaceDuckDbRuntime} from '../document/duckdbRuntime';
import {escapeIdentifier} from '../sql';

export type PreparedWorkspaceFile = {
  id: string;
  originalName: string;
  tableName: string;
  sourceSizeBytes: number;
  parquetBlob: Blob;
  parquetSizeBytes: number;
  rowCount: number;
  contentHash: string;
};

export async function prepareWorkspaceFile({
  runtime,
  file,
  tableName,
}: {
  runtime: WorkspaceDuckDbRuntime;
  file: File;
  tableName?: string;
}): Promise<PreparedWorkspaceFile> {
  if (file.size > SOURCE_FILE_LIMIT_BYTES) {
    throw new Error('Source file is too large. Choose a file up to 50 MB.');
  }

  const targetTableName = tableName ?? createTableName(file.name);
  await runtime.connector.loadFile(file, targetTableName);
  const rowCount = await getTableRowCount(runtime, targetTableName);
  const parquetBlob = await exportTableToParquet(runtime, targetTableName);
  if (parquetBlob.size > PARQUET_UPLOAD_LIMIT_BYTES) {
    throw new Error('Exported Parquet file is too large to upload.');
  }

  return {
    id: crypto.randomUUID(),
    originalName: file.name,
    tableName: targetTableName,
    sourceSizeBytes: file.size,
    parquetBlob,
    parquetSizeBytes: parquetBlob.size,
    rowCount,
    contentHash: await hashBlob(parquetBlob),
  };
}

export async function prepareReplacementWorkspaceFile({
  runtime,
  file,
  tableName,
}: {
  runtime: WorkspaceDuckDbRuntime;
  file: File;
  tableName: string;
}): Promise<PreparedWorkspaceFile> {
  const stagingTableName = `__sqlrooms_upload_${crypto
    .randomUUID()
    .replaceAll('-', '_')}`;

  try {
    const preparedFile = await prepareWorkspaceFile({
      runtime,
      file,
      tableName: stagingTableName,
    });
    await replaceWorkspaceTable({
      runtime,
      stagingTableName,
      tableName,
    });
    return {...preparedFile, tableName};
  } catch (error) {
    await dropWorkspaceTable({runtime, tableName: stagingTableName}).catch(
      () => undefined,
    );
    throw error;
  }
}

export async function uploadPreparedWorkspaceFile({
  token,
  workspaceId,
  preparedFile,
  replaceFileId,
}: {
  token: string;
  workspaceId: string;
  preparedFile: PreparedWorkspaceFile;
  replaceFileId?: string;
}) {
  const {createFileUploadIntent, finalizeFileUpload} =
    await import('../workspace/files');
  const intent = await createFileUploadIntent({
    data: {
      token,
      workspaceId,
      parquetSizeBytes: preparedFile.parquetSizeBytes,
      replaceFileId,
    },
  });

  const uploadResponse = await fetch(intent.uploadUrl, {
    method: 'PUT',
    headers: {'content-type': intent.contentType},
    body: preparedFile.parquetBlob,
  });
  if (!uploadResponse.ok) {
    throw new Error('Could not upload file to storage.');
  }

  return finalizeFileUpload({
    data: {
      token,
      workspaceId,
      fileId: intent.fileId,
      objectKey: intent.objectKey,
      originalName: preparedFile.originalName,
      tableName: preparedFile.tableName,
      parquetSizeBytes: preparedFile.parquetSizeBytes,
      sourceSizeBytes: preparedFile.sourceSizeBytes,
      rowCount: preparedFile.rowCount,
      contentHash: preparedFile.contentHash,
    },
  });
}

export async function loadSavedWorkspaceFile({
  runtime,
  token,
  workspaceId,
  fileId,
  tableName,
}: {
  runtime: WorkspaceDuckDbRuntime;
  token: string;
  workspaceId: string;
  fileId: string;
  tableName: string;
}) {
  const url = `/api/files/${encodeURIComponent(
    fileId,
  )}/read?workspaceId=${encodeURIComponent(workspaceId)}`;
  const response = await fetch(url, {
    headers: {Authorization: `Bearer ${token}`},
  });
  if (!response.ok) {
    throw new Error('Could not load saved file.');
  }
  const blob = await response.blob();
  await runtime.connector.loadFile(
    new File([blob], `${tableName}.parquet`, {
      type: 'application/vnd.apache.parquet',
    }),
    tableName,
    {method: 'read_parquet'},
  );
}

export async function dropWorkspaceTable({
  runtime,
  tableName,
}: {
  runtime: WorkspaceDuckDbRuntime;
  tableName: string;
}) {
  await runtime.connector.execute(
    `drop table if exists ${escapeIdentifier(tableName)}`,
  );
}

async function getTableRowCount(
  runtime: WorkspaceDuckDbRuntime,
  tableName: string,
) {
  const rows = await runtime.connector.queryJson<{row_count: number}>(
    `select count(*)::integer as row_count from ${escapeIdentifier(tableName)}`,
  );
  return Array.from(rows)[0]?.row_count ?? 0;
}

async function exportTableToParquet(
  runtime: WorkspaceDuckDbRuntime,
  tableName: string,
) {
  const outputFileName = `${tableName}_${crypto.randomUUID()}.parquet`;
  if (!isWasmDuckDbConnector(runtime.connector)) {
    throw new Error('Parquet export requires the browser DuckDB runtime.');
  }
  const wasmConnector = runtime.connector;
  let bytes: Uint8Array;
  try {
    await runtime.connector.execute(
      `copy ${escapeIdentifier(tableName)} to '${outputFileName}' (format parquet)`,
    );
    bytes = await wasmConnector.getDb().copyFileToBuffer(outputFileName);
  } finally {
    await wasmConnector
      .getDb()
      .dropFile(outputFileName)
      .catch(() => undefined);
  }
  const copiedBytes = new Uint8Array(bytes.byteLength);
  copiedBytes.set(bytes);
  return new Blob([copiedBytes], {type: 'application/vnd.apache.parquet'});
}

async function replaceWorkspaceTable({
  runtime,
  stagingTableName,
  tableName,
}: {
  runtime: WorkspaceDuckDbRuntime;
  stagingTableName: string;
  tableName: string;
}) {
  await runtime.connector.execute('begin transaction');
  try {
    await dropWorkspaceTable({runtime, tableName});
    await runtime.connector.execute(
      `alter table ${escapeIdentifier(stagingTableName)} rename to ${escapeIdentifier(tableName)}`,
    );
    await runtime.connector.execute('commit');
  } catch (error) {
    await runtime.connector.execute('rollback').catch(() => undefined);
    throw error;
  }
}

async function hashBlob(blob: Blob) {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function createTableName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');
  const sanitized = withoutExtension
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 63);
  const baseName = sanitized || 'uploaded_file';
  return /^\d/.test(baseName) ? `_${baseName}` : baseName;
}
