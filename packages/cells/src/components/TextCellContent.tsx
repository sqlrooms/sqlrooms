import React, {useState, useCallback} from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Button, cn} from '@sqlrooms/ui';
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

  const header = (
    <div className="flex items-center gap-2">
      <Button
        size="xs"
        variant="secondary"
        className="h-6"
        onClick={() => (isEditing ? saveText() : setIsEditing(true))}
      >
        {isEditing ? 'Save' : 'Edit text'}
      </Button>
      <span className="text-[10px] font-bold uppercase text-gray-400">
        Text
      </span>
    </div>
  );

  const content = (
    <div
      className="flex min-h-[100px] flex-col divide-y dark:divide-gray-800"
      onDoubleClick={() => setIsEditing((prev) => !prev)}
    >
      {isEditing && (
        <textarea
          className="bg-accent min-h-[100px] w-full p-3 text-xs outline-none"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="Write text... (Markdown supported)"
          autoFocus
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
    header,
    content,
  });
};
