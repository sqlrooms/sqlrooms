import {PARQUET_UPLOAD_LIMIT_BYTES} from './fileLimits';
import type {WorkspaceDuckDbRuntime} from '../worksheet/duckdbRuntime';

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

export async function uploadPreparedWorkspaceFile({
  token,
  workspaceId,
  preparedFile,
}: {
  token: string;
  workspaceId: string;
  preparedFile: PreparedWorkspaceFile;
}) {
  const {createFileUploadIntent, finalizeFileUpload} =
    await import('../workspace/files');
  const intent = await createFileUploadIntent({
    data: {
      token,
      workspaceId,
      parquetSizeBytes: preparedFile.parquetSizeBytes,
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
  )}/read?workspaceId=${encodeURIComponent(
    workspaceId,
  )}&token=${encodeURIComponent(token)}`;
  const response = await fetch(url);
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
  const wasmConnector = runtime.connector as unknown as {
    getDb(): {
      copyFileToBuffer(name: string): Promise<Uint8Array>;
      dropFile(name: string): Promise<unknown>;
    };
  };
  await runtime.connector.execute(
    `copy ${escapeIdentifier(tableName)} to '${outputFileName}' (format parquet)`,
  );
  const bytes = await wasmConnector.getDb().copyFileToBuffer(outputFileName);
  await wasmConnector.getDb().dropFile(outputFileName);
  const copiedBytes = new Uint8Array(bytes.byteLength);
  copiedBytes.set(bytes);
  return new Blob([copiedBytes], {type: 'application/vnd.apache.parquet'});
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

function escapeIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
