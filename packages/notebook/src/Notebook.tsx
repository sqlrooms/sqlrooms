import {Button, EditableText} from '@sqlrooms/ui';
import React from 'react';
import {useStoreWithNotebook} from './NotebookSlice';

export const TabsBar: React.FC = () => {
  const tabs = useStoreWithNotebook((s) => s.config.notebook.tabs);
  const currentTabId = useStoreWithNotebook(
    (s) => s.config.notebook.currentTabId,
  );
  const setCurrent = useStoreWithNotebook((s) => s.notebook.setCurrentTab);
  const addTab = useStoreWithNotebook((s) => s.notebook.addTab);
  const renameTab = useStoreWithNotebook((s) => s.notebook.renameTab);
  return (
    <div className="flex items-center gap-2 border-b p-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`rounded px-2 py-1 ${
            t.id === currentTabId ? 'bg-muted' : 'hover:bg-muted'
          }`}
          onClick={() => setCurrent(t.id)}
        >
          <EditableText
            value={t.title}
            minWidth={80}
            onChange={(v: string) => renameTab(t.id, v)}
          />
        </button>
      ))}
      <Button size="xs" variant="outline" onClick={() => addTab()}>
        + Add
      </Button>
    </div>
  );
};

export const CellView: React.FC<{id: string}> = ({id}) => {
  const cell = useStoreWithNotebook((s) => s.config.notebook.cells[id]);
  const render = useStoreWithNotebook(
    (s) => s.notebook.cellRegistry[cell?.type || '']?.renderComponent,
  );
  if (!cell || !render) return null;
  return render(id);
};

export const Notebook: React.FC = () => {
  const currentTabId = useStoreWithNotebook(
    (s) => s.config.notebook.currentTabId,
  );
  const tab = useStoreWithNotebook((s) =>
    s.config.notebook.tabs.find((t) => t.id === currentTabId),
  );
  const addCell = useStoreWithNotebook((s) => s.notebook.addCell);
  if (!tab) return null;
  return (
    <div className="flex h-full flex-col">
      <TabsBar />
      <div className="flex items-center gap-2 border-b p-2">
        <Button size="xs" onClick={() => addCell(tab.id, 'sql')}>
          + SQL
        </Button>
        <Button size="xs" onClick={() => addCell(tab.id, 'markdown')}>
          + Markdown
        </Button>
        <Button size="xs" onClick={() => addCell(tab.id, 'text')}>
          + Text
        </Button>
        <Button size="xs" onClick={() => addCell(tab.id, 'vega')}>
          + Vega
        </Button>
        <Button size="xs" onClick={() => addCell(tab.id, 'input')}>
          + Input
        </Button>
      </div>
      <div className="flex-1 space-y-2 overflow-auto p-2">
        {tab.cellOrder.map((id) => (
          <CellView key={id} id={id} />
        ))}
      </div>
    </div>
  );
};
