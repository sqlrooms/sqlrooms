import React from 'react';
import {Button} from '@sqlrooms/ui';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {CellContainer} from './CellContainer';
import {useStoreWithNotebook} from '../NotebookSlice';

export const SqlCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  const run = useStoreWithNotebook((s) => s.notebook.runCell);
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
      <SqlMonacoEditor
        className="h-48"
        value={cell.sql}
        onChange={(v) =>
          update(id, (c) => ({...c, sql: v || ''}) as typeof cell)
        }
      />
      {cell.status === 'error' && (
        <div className="border-t p-2 text-xs text-red-600">
          {cell.lastError}
        </div>
      )}
      {cell.status === 'success' && cell.outputTable && (
        <div className="border-t p-2 text-xs text-green-700">
          Created view: {cell.outputTable}
        </div>
      )}
    </CellContainer>
  );
};
