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
    if (!runtime) {
      setTableNames([]);
      return;
    }
    setTableNames(await runtime.listTables());
  }, [runtime]);

  return {
    runtime,
    tableNames,
    status,
    error,
    refreshTables,
  } satisfies WorkspaceDuckDbRuntimeState;
}
