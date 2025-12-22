import React from 'react';
import {cn, EditableText} from '@sqlrooms/ui';

import {useStoreWithNotebook} from '../useStoreWithNotebook';
import {DeleteCellDialog} from '../cellOperations/DeleteCellDialog';
import {MoveCellButtons} from '../cellOperations/MoveCellButtons';
import {findCellInNotebook} from '../NotebookUtils';

export const CellContainer: React.FC<{
  id: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({id, header, footer, children, className}) => {
  const cell = useStoreWithNotebook(
    (s) => findCellInNotebook(s as any, id)?.cell,
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
        'bg-card group rounded border',
        {
          'border-primary': isCurrent,
        },
        className,
      )}
      onClick={() => setCurrentCell(id)}
    >
      <div className="flex min-h-[36px] items-center justify-between border-b px-2">
        <div className="flex items-center gap-2">
          <EditableText
            value={(cell.data as any).title}
            onChange={(v) => onRename(id, v)}
            className="text-sm font-medium shadow-none outline-none ring-0"
          />
          {header}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div
            className={cn('flex items-center gap-2', {
              'group-hover:flex': !isCurrent,
              hidden: !isCurrent,
            })}
          >
            <DeleteCellDialog cell={cell as any} />
            <MoveCellButtons id={id} />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
      {footer && <div className="border-t">{footer}</div>}
    </div>
  );
};
