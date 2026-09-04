import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  createWorkspaceDuckDbRuntime,
  type WorkspaceDuckDbRuntime,
} from './duckdbRuntime';

export type WorkspaceDuckDbRuntimeState = {
  runtime: WorkspaceDuckDbRuntime | null;
  tableNames: string[];
  status: 'initializing' | 'ready' | 'error';
  error: string | null;
  refreshTables: () => Promise<void>;
};

export function useWorkspaceDuckDbRuntime(workspaceId: string) {
  const workspaceKey = useMemo(
    () => `workspace_${workspaceId.replace(/[^a-zA-Z0-9_]/g, '_')}`,
    [workspaceId],
  );
  const [runtime, setRuntime] = useState<WorkspaceDuckDbRuntime | null>(null);
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [status, setStatus] =
    useState<WorkspaceDuckDbRuntimeState['status']>('initializing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    let nextRuntime: WorkspaceDuckDbRuntime | null = null;

    setRuntime(null);
    setTableNames([]);
    setStatus('initializing');
    setError(null);

    createWorkspaceDuckDbRuntime(workspaceKey)
      .then((createdRuntime) => {
        nextRuntime = createdRuntime;
        if (!isCurrent) return createdRuntime.destroy();

        setRuntime(createdRuntime);
        setStatus('ready');
        return createdRuntime.listTables().then((tables) => {
          if (isCurrent) setTableNames(tables);
        });
      })
      .catch((cause: unknown) => {
        if (!isCurrent) return;
        setStatus('error');
        setError(cause instanceof Error ? cause.message : String(cause));
      });

    return () => {
      isCurrent = false;
      setTableNames([]);
      if (nextRuntime) {
        void nextRuntime.destroy();
      }
    };
  }, [workspaceKey]);

  const refreshTables = useCallback(async () => {
    if (!runtime || runtime.workspaceKey !== workspaceKey) return;
    const nextTableNames = await runtime.listTables();
    setTableNames((currentTableNames) =>
      areTableNamesEqual(currentTableNames, nextTableNames)
        ? currentTableNames
        : nextTableNames,
    );
  }, [runtime, workspaceKey]);

  const isCurrentWorkspace = isWorkspaceRuntimeCurrent(runtime, workspaceKey);
  const hasStaleRuntime = runtime !== null && !isCurrentWorkspace;

  return {
    runtime: isCurrentWorkspace ? runtime : null,
    tableNames: hasStaleRuntime ? [] : tableNames,
    status: hasStaleRuntime ? 'initializing' : status,
    error: hasStaleRuntime ? null : error,
    refreshTables,
  } satisfies WorkspaceDuckDbRuntimeState;
}

export function areTableNamesEqual(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((tableName, index) => tableName === right[index])
  );
}

export function isWorkspaceRuntimeCurrent(
  runtime: WorkspaceDuckDbRuntime | null,
  workspaceKey: string,
) {
  return runtime?.workspaceKey === workspaceKey;
}
