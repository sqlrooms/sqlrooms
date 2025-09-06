import React from 'react';
import {Button} from '@sqlrooms/ui';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {CellContainer} from './CellContainer';
import {useStoreWithNotebook} from '../NotebookSlice';
import {QueryDataTable} from '@sqlrooms/data-table';

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
        <Button size="xs" variant="secondary" onClick={() => run(id)}>
          Run
        </Button>
      }
    >
      <div className="flex h-full w-full flex-col">
        <div className="relative flex-1">
          <SqlMonacoEditor
            className="h-48"
            value={cell.sql}
            options={EDITOR_OPTIONS}
            onChange={(v) =>
              update(id, (c) => ({...c, sql: v || ''}) as typeof cell)
            }
          />
          {cellStatus?.type === 'sql' && (
            <>
              {cellStatus?.status === 'error' && (
                <div className="flex-1 overflow-auto whitespace-pre-wrap border-t p-4 font-mono text-xs text-red-600">
                  {cellStatus.lastError}
                </div>
              )}
              {cellStatus?.status === 'success' && (
                <div className="flex-[2] overflow-hidden border-t">
                  <QueryDataTable
                    query={`SELECT * FROM ${cellStatus.resultView}`}
                    fontSize="text-xs"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </CellContainer>
  );
};
