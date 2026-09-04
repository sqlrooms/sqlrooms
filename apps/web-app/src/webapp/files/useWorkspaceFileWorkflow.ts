import {
  formatBytes as formatByteCount,
  generateUniqueName,
} from '@sqlrooms/utils';
import {useEffect, useMemo, useRef, useState} from 'react';
import type React from 'react';
import {
  createTableName,
  loadSavedWorkspaceFile,
  prepareReplacementWorkspaceFile,
  prepareWorkspaceFile,
  uploadPreparedWorkspaceFile,
  type PreparedWorkspaceFile,
} from './fileIngestion';
import type {useWorkspaceDuckDbRuntime} from '../document/useWorkspaceDuckDbRuntime';
import type {WorkspaceSchemaTableItem} from '../workspace/WorkspaceSidebarSections';
import {escapeIdentifier} from '../sql';
import {areWorkspaceTableNamesEqual, findWorkspaceTableName} from './tableName';

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
    const filesToLoad = workspaceFiles.filter(
      (file) => !loadedTables.has(file.tableName),
    );
    if (filesToLoad.length === 0) return;

    Promise.all(
      filesToLoad.map((file) =>
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
        let isReplacement = false;
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
            isReplacement = true;
            tableName =
              findWorkspaceTableName(existingTableNames, tableName) ??
              tableName;

            if (mode === 'saved' && token) {
              savedFilesToReplace = (workspaceFiles ?? []).filter(
                (workspaceFile) =>
                  areWorkspaceTableNamesEqual(
                    workspaceFile.tableName,
                    tableName,
                  ),
              );
            }
          }
        }

        const preparedFile = isReplacement
          ? await prepareReplacementWorkspaceFile({
              runtime: duckDbRuntime.runtime,
              file,
              tableName,
            })
          : await prepareWorkspaceFile({
              runtime: duckDbRuntime.runtime,
              file,
              tableName,
            });

        if (isReplacement) {
          removePreparedFilesByTableName(nextPreparedFiles, tableName);
          setPreparedLocalFiles((currentFiles) =>
            currentFiles.filter(
              (currentFile) =>
                !areWorkspaceTableNamesEqual(currentFile.tableName, tableName),
            ),
          );
        }
        nextPreparedFiles.push(preparedFile);

        if (mode === 'saved' && token && workspaceId) {
          await uploadPreparedWorkspaceFile({
            token,
            workspaceId,
            preparedFile,
            replaceFileId: savedFilesToReplace[0]?.id,
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
    await uploadPreparedFilesSequentially(
      preparedLocalFiles,
      (preparedFile) =>
        uploadPreparedWorkspaceFile({
          token: uploadToken,
          workspaceId: targetWorkspaceId,
          preparedFile,
        }),
      (preparedFile) =>
        setPreparedLocalFiles((currentFiles) =>
          currentFiles.filter((file) => file.id !== preparedFile.id),
        ),
    );
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

export async function uploadPreparedFilesSequentially<T>(
  files: T[],
  upload: (file: T) => Promise<unknown>,
  onUploaded: (file: T) => void,
) {
  for (const file of files) {
    await upload(file);
    onUploaded(file);
  }
}

function removePreparedFilesByTableName(
  files: PreparedWorkspaceFile[],
  tableName: string,
) {
  for (let index = files.length - 1; index >= 0; index -= 1) {
    if (areWorkspaceTableNamesEqual(files[index].tableName, tableName)) {
      files.splice(index, 1);
    }
  }
}

function hasTableName(tableNames: string[], tableName: string) {
  return findWorkspaceTableName(tableNames, tableName) !== undefined;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  return formatByteCount(bytes);
}
