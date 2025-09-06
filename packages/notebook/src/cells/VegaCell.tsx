import React from 'react';
import {CellContainer} from './CellContainer';
import {useStoreWithNotebook} from '../NotebookSlice';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';

export const VegaCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  if (!cell || cell.type !== 'vega') return null;
  return (
    <CellContainer id={id} typeLabel="Vega">
      <SqlMonacoEditor
        className="h-40"
        value={cell.sql}
        onChange={(v) =>
          update(id, (c) => ({...c, sql: v || ''}) as typeof cell)
        }
      />
      <div className="p-2 text-xs text-gray-500">Chart preview TBD</div>
    </CellContainer>
  );
};
