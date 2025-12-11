import React from 'react';
import {Button, Spinner} from '@sqlrooms/ui';
import {QueryDataTable, QueryDataTableActionsMenu} from '@sqlrooms/data-table';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {BotIcon} from 'lucide-react';

import {CellContainer} from './CellContainer';
import {useStoreWithNotebook} from '../useStoreWithNotebook';
import {AddSqlCellResultToNewTable} from '../cellOperations/AddSqlCellResultToNewTable';
import {IconWithTooltip} from '../cellOperations/IconWithTooltip';
import {useRelativeTimeDisplay} from '../NotebookUtils';

const EDITOR_OPTIONS: Parameters<typeof SqlMonacoEditor>[0]['options'] = {
  minimap: {enabled: false},
  lineNumbers: 'off',
  scrollbar: {
    handleMouseWheel: false,
  },
};

export const SqlCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.notebook.config.cells[id]);
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

  return (
    <CellContainer
      id={id}
      typeLabel="SQL"
      rightControls={
        <>
          <IconWithTooltip
            title="Generate code with AI"
            icon={
              <Button variant="ghost" size="xs" className="h-6 w-6">
                <BotIcon strokeWidth={1.5} size={16} />
              </Button>
            }
          />

          {cellStatus?.type === 'sql' &&
          (cellStatus?.status === 'running' ||
            cellStatus?.status === 'cancel') ? (
            <Button
              size="xs"
              variant="secondary"
              className="flex h-6 gap-1"
              onClick={() => cancel(id)}
              disabled={cellStatus?.status === 'cancel'}
            >
              <Spinner />
              Interrupt
            </Button>
          ) : (
            <Button
              size="xs"
              variant="secondary"
              className="flex h-6 gap-1"
              onClick={() => run(id)}
            >
              Run
            </Button>
          )}
        </>
      }
    >
      <div className="flex h-full w-full flex-col">
        <SqlMonacoEditor
          className="h-48 py-1"
          value={cell.sql}
          options={EDITOR_OPTIONS}
          onChange={(v) =>
            update(id, (c) => ({...c, sql: v || ''}) as typeof cell)
          }
        />
        {cellStatus?.type === 'sql' && (
          <>
            {cellStatus?.status === 'error' && (
              <div className="overflow-auto whitespace-pre-wrap border-t p-4 font-mono text-xs text-red-600">
                {cellStatus.lastError}
              </div>
            )}

            {cellStatus.resultView && (
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
            )}
          </>
        )}
      </div>
    </CellContainer>
  );
};
