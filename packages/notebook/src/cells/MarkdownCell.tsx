import React from 'react';
import {CellContainer} from './CellContainer';
import {useStoreWithNotebook} from '../NotebookSlice';

export const MarkdownCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  if (!cell || cell.type !== 'markdown') return null;
  return (
    <CellContainer id={id} typeLabel="Markdown">
      <textarea
        className="h-32 w-full p-2 text-sm"
        value={cell.markdown}
        onChange={(e) =>
          update(id, (c) => ({...c, markdown: e.target.value}) as typeof cell)
        }
      />
    </CellContainer>
  );
};
