import React from 'react';
import {Button} from '@sqlrooms/ui';
import {QueryDataTable, QueryDataTableActionsMenu} from '@sqlrooms/data-table';
import {BotIcon} from 'lucide-react';
import {SqlCellBody} from '@sqlrooms/cells';

import {CellContainer} from './CellContainer';
import {useStoreWithNotebook} from '../useStoreWithNotebook';
import {AddSqlCellResultToNewTable} from '../cellOperations/AddSqlCellResultToNewTable';
import {IconWithTooltip} from '../cellOperations/IconWithTooltip';
import {findCellInNotebook, useRelativeTimeDisplay} from '../NotebookUtils';

export const SqlCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook(
    (s) => findCellInNotebook(s.notebook.config, id)?.cell,
  );
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  const run = useStoreWithNotebook((s) => s.notebook.runCell);
  const cancel = useStoreWithNotebook((s) => s.notebook.cancelRunCell);
  const cellStatus = useStoreWithNotebook((s) => s.notebook.cellStatus[id]);

  const lastRunTime = useRelativeTimeDisplay(
    cellStatus && cellStatus.type === 'sql' && cellStatus.status === 'success'
      ? (cellStatus.lastRunTime ?? null)
      : null,
  );

  if (!cell || cell.type !== 'sql') return null;

  const status =
    cellStatus?.type === 'sql'
      ? {
          state: cellStatus.status,
          message: cellStatus.lastError,
          resultName: cellStatus.resultView,
        }
      : undefined;

  const renderResult =
    cellStatus?.type === 'sql' && cellStatus.resultView ? (
      <div className="overflow-hidden border-t">
        <QueryDataTable
          query={`SELECT * FROM ${cellStatus.resultView}`}
          fontSize="text-xs"
          pageSize={10}
          className="overflow-hidden rounded-b"
          lastRunTime={cellStatus.lastRunTime}
          isLoading={cellStatus.status === 'running'}
          renderActions={() => (
            <>
              {lastRunTime && (
                <div className="hidden border-l px-2 text-xs lg:inline-flex">
                  Refreshed {lastRunTime}
                </div>
              )}
              <QueryDataTableActionsMenu
                query={`SELECT * FROM ${cellStatus.resultView}`}
              />
              <AddSqlCellResultToNewTable query={cell.sql} />
            </>
          )}
        />
      </div>
    ) : null;

  return (
    <CellContainer id={id} typeLabel="SQL" rightControls={<></>}>
      <SqlCellBody
        sql={cell.sql}
        onSqlChange={(v) => update(id, (c) => ({...c, sql: v}) as typeof cell)}
        onRun={() => run(id)}
        onCancel={() => cancel(id)}
        status={status}
        resultName={
          cellStatus?.type === 'sql' ? cellStatus.resultView : undefined
        }
        renderResult={renderResult}
      />
    </CellContainer>
  );
};
