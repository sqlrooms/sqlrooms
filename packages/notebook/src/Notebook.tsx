import {Button, EditableText} from '@sqlrooms/ui';
import React from 'react';

import {useStoreWithNotebook} from './NotebookSlice';
import {AddNewCell} from './cellOperations/AddNewCell';
import {NotebookCellTypes} from './cellSchemas';
import {
  TriggerButton,
  TriggerSeparator,
} from './cellOperations/AddNewCellTrigger';

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
  const runAllCellsCascade = useStoreWithNotebook(
    (s) => s.notebook.runAllCellsCascade,
  );

  const handleAddCellAndScroll = (type: NotebookCellTypes) => {
    if (!tab) return;
    addCell(tab.id, type);
  };

  if (!tab) return null;
  return (
    <div className="tab-scrollable-content flex h-full flex-col">
      <TabsBar />
      <div className="flex items-center gap-1 px-4 pt-2">
        <AddNewCell
          onAdd={handleAddCellAndScroll}
          triggerComponent={<TriggerButton />}
          enableShortcut
        />
        <Button
          size="xs"
          variant="secondary"
          onClick={() => runAllCellsCascade(tab.id)}
        >
          Run all cells
        </Button>
      </div>

      <div className="flex flex-col space-y-2 overflow-auto p-2">
        {tab.cellOrder.map((id, index) => (
          <div className="flex flex-col gap-2" key={`cellOrder-${id}`}>
            <AddNewCell
              onAdd={(type) => addCell(tab.id, type, index)}
              triggerComponent={<TriggerSeparator />}
            />
            <CellView id={id} />
            <div className="text-secondary text-xs">
              This line is a temporary anchor to prevent mount bug
            </div>
          </div>
        ))}
        <AddNewCell
          onAdd={(type) => addCell(tab.id, type)}
          triggerComponent={<TriggerSeparator />}
        />
      </div>
    </div>
  );
};
