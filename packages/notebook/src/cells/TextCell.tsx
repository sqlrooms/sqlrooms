import React, {useEffect, useState} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Button} from '@sqlrooms/ui';

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
      update(id, (c) => ({...c, text: draft}));
    }
  }, [currentCellId, id, isEditing, draft, update, cell?.type]);

  if (!cell || cell.type !== 'text') return null;

  return (
    <CellContainer
      id={id}
      typeLabel={getCellTypeLabel(cell.type)}
      rightControls={
        currentCellId === id &&
        (isEditing ? (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              update(id, (c) => ({...c, text: draft}));
              setIsEditing(false);
            }}
          >
            Done
          </Button>
        ) : (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setIsEditing(true)}
          >
            Edit text
          </Button>
        ))
      }
    >
      <div
        className="divide-x-muted flex min-h-20"
        onDoubleClick={() => setIsEditing((prev) => !prev)}
      >
        {isEditing && (
          <textarea
            className="bg-accent w-full flex-1 px-3 py-2 text-xs outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write text...(Double click to save and preview)"
            autoFocus
          />
        )}

        <div className="prose dark:prose-invert max-w-none flex-1 px-3 py-2 text-sm">
          <Markdown remarkPlugins={[remarkGfm]}>{draft}</Markdown>
        </div>
      </div>
    </CellContainer>
  );
};
