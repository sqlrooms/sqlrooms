import React from 'react';
import {cn, EditableText} from '@sqlrooms/ui';

import {useStoreWithNotebook} from '../useStoreWithNotebook';
import {DeleteCellDialog} from '../cellOperations/DeleteCellDialog';
import {MoveCellButtons} from '../cellOperations/MoveCellButtons';
import {findCellInNotebook} from '../NotebookUtils';

export const CellContainer: React.FC<{
  id: string;
  typeLabel: string;
  rightControls?: React.ReactNode;
  leftControls?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({id, typeLabel, rightControls, leftControls, children, className}) => {
  const cell = useStoreWithNotebook(
    (s) => findCellInNotebook(s.notebook.config, id)?.cell,
  );
  const onRename = useStoreWithNotebook((s) => s.notebook.renameCell);
  const setCurrentCell = useStoreWithNotebook((s) => s.notebook.setCurrentCell);
  const currentCellId = useStoreWithNotebook(
    (s) => s.notebook.config.currentCellId,
  );
  const isCurrent = currentCellId === id;

  if (!cell) return null;
  return (
    <div
      className={cn(
        'group rounded border',
        {
          'border-primary': isCurrent,
        },
        className,
      )}
      onClick={() => setCurrentCell(id)}
    >
      <div className="flex items-center justify-between border-b px-2">
        <div className="flex items-center gap-2">
          <EditableText
            value={cell.name}
            onChange={(v) => onRename(id, v)}
            className="shadow-none outline-none ring-0"
          />
          {leftControls}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div
            className={cn('flex items-center gap-2', {
              'group-hover:flex': !isCurrent,
              hidden: !isCurrent,
            })}
          >
            <span className="uppercase text-gray-500">{typeLabel}</span>
            <DeleteCellDialog cell={cell} />
            <MoveCellButtons id={id} />
          </div>
          {rightControls}
        </div>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
};
