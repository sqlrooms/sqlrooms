import React, {useEffect, useState} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Button, cn} from '@sqlrooms/ui';

import {CellContainer} from './CellContainer';
import {useStoreWithNotebook} from '../NotebookSlice';
import {getCellTypeLabel} from '../NotebookUtils';

export const TextCell: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.notebook.config.cells[id]);
  const update = useStoreWithNotebook((s) => s.notebook.updateCell);
  const currentCellId = useStoreWithNotebook(
    (s) => s.notebook.config.currentCellId,
  );
  const [isEditing, setIsEditing] = useState(currentCellId === id);
  const [draftText, setDraftText] = useState(
    cell?.type === 'text' ? cell.text : '',
  );

  useEffect(() => {
    if (currentCellId !== id && isEditing) {
      setIsEditing(false);
      update(id, (c) => ({...c, text: draftText}));
    }
  }, [currentCellId, id, isEditing, draftText, update]);

  const isCurrent = currentCellId === id;

  if (!cell || cell.type !== 'text') return null;

  return (
    <CellContainer
      id={id}
      typeLabel={getCellTypeLabel(cell.type)}
      rightControls={
        isEditing ? (
          <Button
            size="xs"
            variant="secondary"
            className="h-6"
            onClick={() => {
              update(id, (c) => ({...c, text: draftText}));
              setIsEditing(false);
            }}
          >
            Save
          </Button>
        ) : (
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setIsEditing(true)}
            className={cn({hidden: !isCurrent}, 'h-6 group-hover:flex')}
          >
            Edit text
          </Button>
        )
      }
    >
      <div
        className="divide-x-muted flex min-h-20"
        onDoubleClick={() => setIsEditing((prev) => !prev)}
      >
        {isEditing && (
          <textarea
            className="bg-accent w-full flex-1 px-3 py-2 text-xs outline-none"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Write text...(Double click to save and preview)"
            autoFocus
          />
        )}

        <div className="prose dark:prose-invert max-w-none flex-1 px-3 py-2 text-sm">
          <Markdown remarkPlugins={[remarkGfm]}>{draftText}</Markdown>
        </div>
      </div>
    </CellContainer>
  );
};
