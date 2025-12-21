import React, {useState} from 'react';
import {Button} from '@sqlrooms/ui';
import {Notebook, useStoreWithNotebook} from '@sqlrooms/notebook';
import {Canvas} from '@sqlrooms/canvas';

const NotebookListView: React.FC = () => {
  const currentSheetId = useStoreWithNotebook(
    (s) => s.notebook.config.currentSheetId,
  );
  const sheet = useStoreWithNotebook((s) =>
    currentSheetId ? s.notebook.config.sheets[currentSheetId] : undefined,
  );
  const cellsData = useStoreWithNotebook((s) => s.cells.config.data);

  if (!sheet) return <div className="p-4 text-sm">No notebook selected.</div>;
  return (
    <div className="flex flex-col gap-2 p-4 text-sm">
      <div className="font-semibold">Cells</div>
      {sheet.meta.cellOrder.length === 0
        ? 'No cells yet.'
        : sheet.meta.cellOrder.map((id: string) => {
            const cell = cellsData[id];
            if (!cell) return null;
            return (
              <div key={id} className="flex items-center gap-2">
                <span className="rounded bg-muted px-2 py-1 text-xs">
                  {cell.type}
                </span>
                <span>{(cell.data as any).title || id}</span>
              </div>
            );
          })}
    </div>
  );
};

export const NotebookPanel: React.FC = () => {
  const [view, setView] = useState<'notebook' | 'list' | 'canvas'>('notebook');
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2 text-sm">
        <span className="font-semibold">View</span>
        <Button
          size="xs"
          variant={view === 'notebook' ? 'secondary' : 'ghost'}
          onClick={() => setView('notebook')}
        >
          Notebook
        </Button>
        <Button
          size="xs"
          variant={view === 'list' ? 'secondary' : 'ghost'}
          onClick={() => setView('list')}
        >
          List
        </Button>
        <Button
          size="xs"
          variant={view === 'canvas' ? 'secondary' : 'ghost'}
          onClick={() => setView('canvas')}
        >
          Canvas
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {view === 'notebook' ? (
          <Notebook />
        ) : view === 'list' ? (
          <NotebookListView />
        ) : (
          <Canvas />
        )}
      </div>
    </div>
  );
};
