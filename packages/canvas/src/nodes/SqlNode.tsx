import {QueryDataTable} from '@sqlrooms/data-table';
import {Button, useToast} from '@sqlrooms/ui';
import {FC, useMemo} from 'react';
import {SqlCellBody, type SqlCellBodyStatus} from '@sqlrooms/cells';
import {CanvasNodeData, useStoreWithCanvas} from '../CanvasSlice';
import {CanvasNodeContainer} from './CanvasNodeContainer';
// import type * as Monaco from 'monaco-editor';
// type EditorInstance = Monaco.editor.IStandaloneCodeEditor;
// type MonacoInstance = typeof Monaco;

type SqlData = Extract<CanvasNodeData, {type: 'sql'}>;

export const SqlNode: FC<{id: string; data: SqlData}> = ({id, data}) => {
  const sql = data.sql || '';
  const updateNode = useStoreWithCanvas((s) => s.canvas.updateNode);
  const tables = useStoreWithCanvas((s) => s.db.tables);
  const execute = useStoreWithCanvas((s) => s.canvas.executeSqlNodeQuery);
  const result = useStoreWithCanvas((s) => s.canvas.sqlResults[id]);
  const {toast} = useToast();

  const status: SqlCellBodyStatus =
    result?.status === 'success'
      ? {state: 'success', resultName: result.tableName}
      : result?.status === 'error'
        ? {state: 'error', message: result.error}
        : result?.status === 'loading'
          ? {state: 'running'}
          : {state: 'idle'};

  return (
    <CanvasNodeContainer
      id={id}
      headerRight={
        <>
          <Button size="sm" variant="secondary" onClick={() => execute(id)}>
            Run
          </Button>
          <span className="text-[10px] uppercase text-gray-500">SQL</span>
        </>
      }
    >
      <SqlCellBody
        sql={sql}
        onSqlChange={(v) =>
          updateNode(id, (d: CanvasNodeData) => ({
            ...(d as SqlData),
            sql: v || '',
          }))
        }
        onRun={() =>
          execute(id).catch((e) =>
            toast({
              title: 'Run failed',
              description: e instanceof Error ? e.message : String(e),
              variant: 'destructive',
            }),
          )
        }
        status={status}
        resultName={result?.status === 'success' ? result.tableName : undefined}
        renderResult={
          result?.status === 'success' ? (
            <div className="flex-[2] overflow-hidden border-t">
              <QueryDataTable
                query={`SELECT * FROM ${result.tableName}`}
                fontSize="text-xs"
              />
            </div>
          ) : undefined
        }
      />
    </CanvasNodeContainer>
  );
};
