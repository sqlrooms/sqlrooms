import {generateUniqueName} from '@sqlrooms/utils';
import {useEffect, useMemo, useRef, useState} from 'react';
import type React from 'react';
import {
  createTableName,
  dropWorkspaceTable,
  loadSavedWorkspaceFile,
  prepareWorkspaceFile,
  uploadPreparedWorkspaceFile,
  type PreparedWorkspaceFile,
} from './fileIngestion';
import {deleteWorkspaceFile} from '../workspace/files';
import type {useWorkspaceDuckDbRuntime} from '../worksheet/useWorkspaceDuckDbRuntime';
import type {WorkspaceSchemaTableItem} from '../workspace/WorkspaceSidebarSections';

export type FileConflictResolution =
  | {action: 'replace'}
  | {action: 'keep-both'; tableName: string}
  | {action: 'cancel'};

export type FileNameConflict = {
  fileName: string;
  tableName: string;
  uniqueTableName: string;
  resolve: (resolution: FileConflictResolution) => void;
};

export type TablePreview = {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  status: 'loading' | 'ready' | 'error';
  error?: string;
};

type WorkspaceFileSummary = {
  id: string;
  tableName: string;
  sizeBytes: number;
};

export function useWorkspaceFileWorkflow({
  mode,
  workspaceId,
  token,
  duckDbRuntime,
  workspaceFiles,
  invalidateWorkspaceFiles,
  openSignInToSave,
}: {
  mode: 'saved' | 'unsaved';
  workspaceId: string | null;
  token: string | null;
  duckDbRuntime: ReturnType<typeof useWorkspaceDuckDbRuntime>;
  workspaceFiles: WorkspaceFileSummary[] | undefined;
  invalidateWorkspaceFiles: () => Promise<unknown>;
  openSignInToSave: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preparedLocalFiles, setPreparedLocalFiles] = useState<
    PreparedWorkspaceFile[]
  >([]);
  const [fileIngestionStatus, setFileIngestionStatus] = useState<string | null>(
    null,
  );
  const [fileNameConflict, setFileNameConflict] =
    useState<FileNameConflict | null>(null);
  const [tablePreview, setTablePreview] = useState<TablePreview | null>(null);
  const workspaceTableNames = useMemo(
    () =>
      Array.from(
        new Set([
          ...(workspaceFiles ?? []).map((file) => file.tableName),
          ...duckDbRuntime.tableNames,
          ...preparedLocalFiles.map((file) => file.tableName),
        ]),
      ),
    [duckDbRuntime.tableNames, preparedLocalFiles, workspaceFiles],
  );
  const fileBackedTableNames = useMemo(
    () =>
      new Set([
        ...(workspaceFiles ?? []).map((file) => file.tableName),
        ...preparedLocalFiles.map((file) => file.tableName),
      ]),
    [preparedLocalFiles, workspaceFiles],
  );
  const runtimeOnlyTableNames = useMemo(
    () =>
      duckDbRuntime.tableNames.filter(
        (tableName) => !fileBackedTableNames.has(tableName),
      ),
    [duckDbRuntime.tableNames, fileBackedTableNames],
  );
  const schemaTableItems = useMemo<WorkspaceSchemaTableItem[]>(
    () => [
      ...(workspaceFiles ?? []).map((file) => ({
        key: `saved:${file.id}`,
        name: file.tableName,
        meta: formatBytes(file.sizeBytes),
      })),
      ...runtimeOnlyTableNames.map((tableName) => ({
        key: `runtime:${tableName}`,
        name: tableName,
        meta: 'In memory',
      })),
      ...preparedLocalFiles.map((file) => ({
        key: `prepared:${file.id}`,
        name: file.tableName,
        meta: formatBytes(file.parquetSizeBytes),
      })),
    ],
    [preparedLocalFiles, runtimeOnlyTableNames, workspaceFiles],
  );

  useEffect(() => {
    if (
      mode !== 'saved' ||
      !workspaceId ||
      !token ||
      !duckDbRuntime.runtime ||
      !workspaceFiles?.length
    ) {
      return;
    }

    let isCurrent = true;
    const runtime = duckDbRuntime.runtime;
    const loadedTables = new Set(duckDbRuntime.tableNames);

    Promise.all(
      workspaceFiles
        .filter((file) => !loadedTables.has(file.tableName))
        .map((file) =>
          loadSavedWorkspaceFile({
            runtime,
            token,
            workspaceId,
            fileId: file.id,
            tableName: file.tableName,
          }),
        ),
    )
      .then(() => {
        if (isCurrent) return duckDbRuntime.refreshTables();
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setFileIngestionStatus(
          error instanceof Error
            ? error.message
            : 'Could not load saved files.',
        );
      });

    return () => {
      isCurrent = false;
    };
  }, [
    duckDbRuntime.refreshTables,
    duckDbRuntime.runtime,
    duckDbRuntime.tableNames,
    mode,
    token,
    workspaceFiles,
    workspaceId,
  ]);

  const addFile = () => {
    if (!duckDbRuntime.runtime) {
      setFileIngestionStatus('Preparing runtime');
      return;
    }

    if (mode === 'saved' && !token) {
      openSignInToSave();
      return;
    }

    fileInputRef.current?.click();
  };

  const previewTable = async (tableName: string) => {
    if (!duckDbRuntime.runtime) return;

    setTablePreview({
      tableName,
      columns: [],
      rows: [],
      status: 'loading',
    });

    try {
      const rows = Array.from(
        await duckDbRuntime.runtime.connector.queryJson<
          Record<string, unknown>
        >(`select * from ${escapeIdentifier(tableName)} limit 25`),
      );
      setTablePreview({
        tableName,
        columns: Array.from(new Set(rows.flatMap((row) => Object.keys(row)))),
        rows,
        status: 'ready',
      });
    } catch (error) {
      setTablePreview({
        tableName,
        columns: [],
        rows: [],
        status: 'error',
        error:
          error instanceof Error ? error.message : 'Could not preview table.',
      });
    }
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!duckDbRuntime.runtime || files.length === 0) return;

    void ingestFiles(files);
  };

  const askFileNameConflict = ({
    fileName,
    tableName,
    existingNames,
  }: {
    fileName: string;
    tableName: string;
    existingNames: string[];
  }) =>
    new Promise<FileConflictResolution>((resolve) => {
      setFileNameConflict({
        fileName,
        tableName,
        uniqueTableName: generateUniqueName(tableName, existingNames),
        resolve,
      });
    });

  const resolveFileNameConflict = (resolution: FileConflictResolution) => {
    fileNameConflict?.resolve(resolution);
    setFileNameConflict(null);
  };

  const ingestFiles = async (files: File[]) => {
    if (!duckDbRuntime.runtime) return;

    setFileIngestionStatus('Loading file');
    try {
      const nextPreparedFiles: PreparedWorkspaceFile[] = [];
      for (const file of files) {
        let tableName = createTableName(file.name);
        let savedFilesToReplace: {id: string; tableName: string}[] = [];
        const existingTableNames = [
          ...workspaceTableNames,
          ...nextPreparedFiles.map((preparedFile) => preparedFile.tableName),
        ];

        if (hasTableName(existingTableNames, tableName)) {
          const resolution = await askFileNameConflict({
            fileName: file.name,
            tableName,
            existingNames: existingTableNames,
          });

          if (resolution.action === 'cancel') {
            continue;
          }

          if (resolution.action === 'keep-both') {
            tableName = resolution.tableName;
          } else {
            await dropWorkspaceTable({
              runtime: duckDbRuntime.runtime,
              tableName,
            });
            removePreparedFilesByTableName(nextPreparedFiles, tableName);
            setPreparedLocalFiles((currentFiles) =>
              currentFiles.filter(
                (currentFile) => currentFile.tableName !== tableName,
              ),
            );

            if (mode === 'saved' && token) {
              savedFilesToReplace = (workspaceFiles ?? []).filter(
                (workspaceFile) => workspaceFile.tableName === tableName,
              );
            }
          }
        }

        const preparedFile = await prepareWorkspaceFile({
          runtime: duckDbRuntime.runtime,
          file,
          tableName,
        });
        nextPreparedFiles.push(preparedFile);

        if (mode === 'saved' && token && workspaceId) {
          for (const workspaceFile of savedFilesToReplace) {
            await deleteWorkspaceFile({
              data: {
                token,
                workspaceId,
                fileId: workspaceFile.id,
              },
            });
          }

          await uploadPreparedWorkspaceFile({
            token,
            workspaceId,
            preparedFile,
          });
          await invalidateWorkspaceFiles();
        }
      }

      if (mode === 'unsaved' || !token) {
        setPreparedLocalFiles((currentFiles) => [
          ...currentFiles,
          ...nextPreparedFiles,
        ]);
      }
      await duckDbRuntime.refreshTables();
      if (mode === 'saved' && token) {
        await invalidateWorkspaceFiles();
      }
      setFileIngestionStatus(null);
    } catch (error) {
      setFileIngestionStatus(
        error instanceof Error ? error.message : 'Could not add file.',
      );
    }
  };

  const uploadPreparedLocalFiles = async ({
    uploadToken,
    targetWorkspaceId,
  }: {
    uploadToken: string;
    targetWorkspaceId: string;
  }) => {
    for (const preparedFile of preparedLocalFiles) {
      await uploadPreparedWorkspaceFile({
        token: uploadToken,
        workspaceId: targetWorkspaceId,
        preparedFile,
      });
    }
    setPreparedLocalFiles([]);
  };

  return {
    fileInputRef,
    preparedLocalFiles,
    fileIngestionStatus,
    schemaTableItems,
    tablePreview,
    fileNameConflict,
    addFile,
    previewTable,
    closeTablePreview: () => setTablePreview(null),
    handleFileInputChange,
    resolveFileNameConflict,
    uploadPreparedLocalFiles,
  };
}

function removePreparedFilesByTableName(
  files: PreparedWorkspaceFile[],
  tableName: string,
) {
  for (let index = files.length - 1; index >= 0; index -= 1) {
    if (files[index].tableName === tableName) {
      files.splice(index, 1);
    }
  }
}

function hasTableName(tableNames: string[], tableName: string) {
  return tableNames.some(
    (existingTableName) =>
      existingTableName.toLowerCase() === tableName.toLowerCase(),
  );
}

function escapeIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}
