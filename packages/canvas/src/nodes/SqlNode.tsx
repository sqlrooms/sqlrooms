import {QueryDataTable} from '@sqlrooms/data-table';
import {Button, useToast} from '@sqlrooms/ui';
import {FC} from 'react';
import {
  SqlCellBody,
  type SqlCellBodyStatus,
  type SqlCellData,
} from '@sqlrooms/cells';
import {useStoreWithCanvas} from '../CanvasSlice';
import {CanvasNodeContainer} from './CanvasNodeContainer';
import {produce} from 'immer';

export const SqlNode: FC<{id: string; data: SqlCellData}> = ({id, data}) => {
  const sql = data.sql || '';
  const updateNode = useStoreWithCanvas((s) => s.canvas.updateNode);
  const execute = useStoreWithCanvas((s) => s.canvas.executeSqlNodeQuery);
  const cellStatus = useStoreWithCanvas((s) => s.cells.status[id]);
  const cancel = useStoreWithCanvas((s) => s.cells.cancelCell);
  const {toast} = useToast();

  const status: SqlCellBodyStatus =
    cellStatus?.type === 'sql'
      ? {
          state: cellStatus.status,
          message: cellStatus.lastError,
          resultName: cellStatus.resultName,
        }
      : undefined;

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
          updateNode(id, (c) =>
            produce(c, (draft) => {
              if (draft.type === 'sql') draft.data.sql = v || '';
            }),
          )
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
        onCancel={() => cancel(id)}
        status={status}
        resultName={
          cellStatus?.type === 'sql' ? cellStatus.resultName : undefined
        }
        renderResult={
          cellStatus?.type === 'sql' && cellStatus.resultName ? (
            <div className="flex-[2] overflow-hidden border-t">
              <QueryDataTable
                query={`SELECT * FROM ${cellStatus.resultName}`}
                fontSize="text-xs"
              />
            </div>
          ) : undefined
        }
      />
    </CanvasNodeContainer>
  );
};
