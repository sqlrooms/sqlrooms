import React, {useState} from 'react';
import {Button} from '@sqlrooms/ui';
import {Notebook, useStoreWithNotebook} from '@sqlrooms/notebook';

const NotebookListView: React.FC = () => {
  const currentDagId = useStoreWithNotebook(
    (s) => s.notebook.config.currentDagId,
  );
  const dag = useStoreWithNotebook((s) =>
    currentDagId ? s.notebook.config.dags[currentDagId] : undefined,
  );
  if (!dag) return <div className="p-4 text-sm">No notebook selected.</div>;
  return (
    <div className="flex flex-col gap-2 p-4 text-sm">
      <div className="font-semibold">Cells</div>
      {dag.meta.cellOrder.length === 0
        ? 'No cells yet.'
        : dag.meta.cellOrder.map((id) => {
            const cell = dag.cells[id];
            return (
              <div key={id} className="flex items-center gap-2">
                <span className="rounded bg-muted px-2 py-1 text-xs">
                  {cell.type}
                </span>
                <span>{(cell as any).name || id}</span>
              </div>
            );
          })}
    </div>
  );
};

export const NotebookPanel: React.FC = () => {
  const [view, setView] = useState<'notebook' | 'list'>('notebook');
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
      </div>
      <div className="min-h-0 flex-1">
        {view === 'notebook' ? <Notebook /> : <NotebookListView />}
      </div>
    </div>
  );
};
