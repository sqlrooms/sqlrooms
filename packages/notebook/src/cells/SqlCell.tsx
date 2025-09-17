import React from 'react';
import {Button} from '@sqlrooms/ui';
import {QueryDataTable, QueryDataTableActionsMenu} from '@sqlrooms/data-table';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {BotIcon} from 'lucide-react';

import {CellContainer} from './CellContainer';
import {useStoreWithNotebook} from '../NotebookSlice';
import {AddSqlCellResultToNewTable} from '../cellOperations/AddSqlCellResultToNewTable';
import {IconWithTooltip} from '../cellOperations/IconWithTooltip';

const EDITOR_OPTIONS: Parameters<typeof SqlMonacoEditor>[0]['options'] = {
  minimap: {enabled: false},
  lineNumbers: 'off',
  scrollbar: {
    handleMouseWheel: false,
  },
};

export const SqlCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  const run = useStoreWithNotebook((s) => s.notebook.runCell);
  const cellStatus = useStoreWithNotebook((s) => s.notebook.cellStatus[id]);

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
          <Button
            size="xs"
            variant="secondary"
            className="h-6"
            onClick={() => run(id)}
          >
            Run
          </Button>
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
            {cellStatus?.status === 'success' && (
              <div className="overflow-hidden border-t">
                {(() => {
                  const query = `SELECT * FROM ${cellStatus.resultView}`;
                  return (
                    <QueryDataTable
                      query={query}
                      fontSize="text-xs"
                      renderActions={() => (
                        <>
                          <QueryDataTableActionsMenu query={query} />
                          <AddSqlCellResultToNewTable query={cell.sql} />
                        </>
                      )}
                    />
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </CellContainer>
  );
};
