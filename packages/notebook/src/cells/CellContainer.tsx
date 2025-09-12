import React from 'react';
import {cn, EditableText} from '@sqlrooms/ui';

import {useStoreWithNotebook} from '../NotebookSlice';
import {DeleteCellDialog} from '../cellOperations/DeleteCellDialog';
import {MoveCellButtons} from '../cellOperations/MoveCellButtons';

export const CellContainer: React.FC<{
  id: string;
  typeLabel: string;
  rightControls?: React.ReactNode;
  children?: React.ReactNode;
}> = ({id, typeLabel, rightControls, children}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const onRename = useStoreWithNotebook((s) => s.notebook.renameCell);
  const setCurrentCell = useStoreWithNotebook((s) => s.notebook.setCurrentCell);
  const currentCellId = useStoreWithNotebook(
    (s) => s.config.notebook.currentCellId,
  );

  if (!cell) return null;
  return (
    <div
      className={cn('rounded border', {
        'border-primary': currentCellId === id,
      })}
      onClick={() => setCurrentCell(id)}
    >
      <div className="flex items-center justify-between border-b px-2 py-1">
        <EditableText
          value={cell.name}
          onChange={(v) => onRename(id, v)}
          minWidth={20}
        />

        <div className="flex items-center gap-1 text-xs">
          <span className="uppercase text-gray-500">{typeLabel}</span>
          <DeleteCellDialog cell={cell} />
          <MoveCellButtons id={id} />
          {rightControls}
        </div>
      </div>
      {children}
    </div>
  );
};
