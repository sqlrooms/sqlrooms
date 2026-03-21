import React, {useState, useCallback, useRef, useEffect} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const saveText = useCallback(() => {
    updateCell(id, (cell) =>
      produce(cell, (draft) => {
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

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && isEditing) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [draftText, isEditing]);

  const content = (
    <div
      className="flex flex-col divide-y dark:divide-gray-800"
      onDoubleClick={() => !isEditing && setIsEditing(true)}
    >
      {isEditing && (
        <textarea
          ref={textareaRef}
          className="bg-accent w-full resize-none overflow-hidden p-3 text-sm leading-relaxed outline-none"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Write text... (Markdown supported)"
          autoFocus
          onBlur={saveText}
          rows={1}
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
          <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>
            {cell.data.text || '_No content yet. Double click to edit._'}
          </Markdown>
        </div>
      )}
    </div>
  );

  return renderContainer({
    showHeader: false,
    content,
  });
};
