import React, {useState, useCallback} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {useCellsStore} from '../hooks';
import type {CellContainerProps, TextCell} from '../types';
import {produce} from 'immer';

export type TextCellContentProps = {
  id: string;
  cell: TextCell;
  renderContainer: (props: CellContainerProps) => React.ReactElement;
};

export const TextCellContent: React.FC<TextCellContentProps> = ({
  id,
  cell,
  renderContainer,
}) => {
  const updateCell = useCellsStore((s) => s.cells.updateCell);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(cell.data.text);

  const saveText = useCallback(() => {
    updateCell(id, (c) =>
      produce(c, (draft) => {
        if (draft.type === 'text') {
          draft.data.text = draftText;
        }
      }),
    );
    setIsEditing(false);
  }, [id, draftText, updateCell]);

  const cancelEdit = useCallback(() => {
    setDraftText(cell.data.text);
    setIsEditing(false);
  }, [cell.data.text]);

  const content = (
    <div
      className="flex flex-col divide-y dark:divide-gray-800"
      onDoubleClick={() => !isEditing && setIsEditing(true)}
    >
      {isEditing && (
        <textarea
          className="bg-accent w-full p-3 text-sm outline-none"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Write text... (Markdown supported)"
          autoFocus
          onBlur={saveText}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          }}
        />
      )}
      {!isEditing && (
        <div className="prose dark:prose-invert max-w-none flex-1 p-3 text-sm">
          <Markdown remarkPlugins={[remarkGfm]}>
            {cell.data.text || '_No content yet. Double click to edit._'}
          </Markdown>
        </div>
      )}
    </div>
  );

  return renderContainer({
    hideHeader: true,
    content,
  });
};
