import React, {useEffect, useState} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {CellContainer} from './CellContainer';
import {useStoreWithNotebook} from '../NotebookSlice';
import {getCellTypeLabel} from '../NotebookUtils';

export const TextCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  const currentCellId = useStoreWithNotebook(
    (s) => s.config.notebook.currentCellId,
  );
  const [isEditing, setIsEditing] = useState(currentCellId === id);
  const [draft, setDraft] = useState(cell?.type === 'text' ? cell.text : '');

  useEffect(() => {
    if (currentCellId !== id && isEditing && cell?.type === 'text') {
      setIsEditing(false);
      update(id, (c) => ({...c, markdown: draft}));
    }
  }, [currentCellId, id, isEditing, draft, update, cell?.type]);

  if (!cell || cell.type !== 'text') return null;

  return (
    <CellContainer id={id} typeLabel={getCellTypeLabel(cell.type)}>
      <div
        className="divide-x-muted grid min-h-20 grid-cols-2 divide-x"
        onDoubleClick={() => setIsEditing((prev) => !prev)}
      >
        {isEditing && (
          <textarea
            className="bg-background w-full px-3 py-2 text-xs outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write text...(Double click to save and preview)"
            autoFocus
          />
        )}
        <div className="prose dark:prose-invert max-w-none px-3 py-2 text-sm">
          <Markdown remarkPlugins={[remarkGfm]}>{draft}</Markdown>
        </div>
      </div>
    </CellContainer>
  );
};
