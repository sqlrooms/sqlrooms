import React from 'react';
import {cn, EditableText} from '@sqlrooms/ui';

import {useStoreWithNotebook} from '../useStoreWithNotebook';
import {DeleteCellDialog} from '../cellOperations/DeleteCellDialog';
import {MoveCellButtons} from '../cellOperations/MoveCellButtons';
import {findCellInNotebook} from '../NotebookUtils';

export type CellContainerProps = {
  id: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
};

export const CellContainer: React.FC<CellContainerProps> = ({
  id,
  header,
  footer,
  children,
  className,
  hideHeader,
}) => {
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
      id={`cell-${id}`}
      data-cell-container-id={id}
      className={cn(
        'group relative rounded',
        hideHeader
          ? isCurrent
            ? 'border-primary border'
            : ''
          : cn('bg-card border', isCurrent && 'border-primary'),
        className,
      )}
      onClick={() => setCurrentCell(id)}
    >
      {hideHeader ? (
        <div
          className={cn(
            'absolute top-1 right-1 z-10 items-center gap-1',
            isCurrent
              ? 'flex'
              : 'hidden group-focus-within:flex group-hover:flex',
          )}
          onMouseDown={(e) => e.preventDefault()}
        >
          <DeleteCellDialog cell={cell as any} />
          <MoveCellButtons id={id} />
        </div>
      ) : (
        <div className="flex min-h-[36px] items-center justify-between gap-2 border-b px-2">
          <div className="flex h-6 flex-1 items-center gap-2">
            <EditableText
              editTrigger="doubleClick"
              value={(cell.data as any).title}
              onChange={(v) => onRename(id, v)}
              className="h-full text-sm font-medium shadow-none ring-0 outline-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2 text-xs">
            <div
              className={cn('flex items-center gap-2', {
                'group-hover:flex': !isCurrent,
                hidden: !isCurrent,
              })}
            >
              <DeleteCellDialog cell={cell as any} />
              <MoveCellButtons id={id} />
            </div>
            <div>{header}</div>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto">{children}</div>
      {footer && <div className="border-t">{footer}</div>}
    </div>
  );
};
