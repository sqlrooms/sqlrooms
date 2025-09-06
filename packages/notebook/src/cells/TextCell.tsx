import React from 'react';
import {CellContainer} from './CellContainer';
import {useStoreWithNotebook} from '../NotebookSlice';

export const TextCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  if (!cell || cell.type !== 'text') return null;
  return (
    <CellContainer id={id} typeLabel="Text">
      <textarea
        className="h-32 w-full p-2 text-sm"
        value={cell.text}
        onChange={(e) =>
          update(id, (c) => ({...c, text: e.target.value}) as typeof cell)
        }
      />
    </CellContainer>
  );
};
