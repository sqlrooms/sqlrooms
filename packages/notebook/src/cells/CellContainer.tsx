import React from 'react';
import {EditableText} from '@sqlrooms/ui';
import {useStoreWithNotebook} from '../NotebookSlice';

export const CellContainer: React.FC<{
  id: string;
  typeLabel: string;
  rightControls?: React.ReactNode;
  children?: React.ReactNode;
}> = ({id, typeLabel, rightControls, children}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const rename = useStoreWithNotebook((s) => s.notebook.renameCell);
  if (!cell) return null;
  return (
    <div className="rounded border">
      <div className="flex items-center justify-between border-b px-2 py-1">
        <EditableText
          value={(cell as any).name}
          onChange={(v) => rename(id, v)}
        />
        <div className="flex items-center gap-2 text-xs">
          <span className="uppercase text-gray-500">{typeLabel}</span>
          {rightControls}
        </div>
      </div>
      {children}
    </div>
  );
};
