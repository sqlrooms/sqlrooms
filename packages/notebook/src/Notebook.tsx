import {Button, EditableText} from '@sqlrooms/ui';
import React, {useEffect} from 'react';
import {PlusIcon} from 'lucide-react';

import {useStoreWithNotebook} from './NotebookSlice';
import {AddNewCellDropdown} from './cellOperations/AddNewCellDropdown';
import {NotebookCellTypes} from './cellSchemas';
import {AddNewCellTabs} from './cellOperations/AddNewCellTabs';
import {InputBar, ShowInputBarToggle} from './cells/InputBar';
import {CellView} from './cells/CellView';

export const TabsBar: React.FC = () => {
  const tabs = useStoreWithNotebook((s) => s.config.notebook.tabs);
  const currentTabId = useStoreWithNotebook(
    (s) => s.config.notebook.currentTabId,
  );
  const setCurrent = useStoreWithNotebook((s) => s.notebook.setCurrentTab);
  const addTab = useStoreWithNotebook((s) => s.notebook.addTab);
  const renameTab = useStoreWithNotebook((s) => s.notebook.renameTab);
  return (
    <div className="bg-muted flex items-center gap-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`rounded-t px-2 py-0 ${
            t.id === currentTabId
              ? 'bg-background border-muted border-x-2 border-t-2'
              : 'hover:bg-background'
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
      <Button size="xs" variant="ghost" onClick={() => addTab()}>
        <PlusIcon size={14} strokeWidth={2} />
      </Button>
    </div>
  );
};

export const Notebook: React.FC = () => {
  const currentTabId = useStoreWithNotebook(
    (s) => s.config.notebook.currentTabId,
  );
  const currentCellId = useStoreWithNotebook(
    (s) => s.config.notebook.currentCellId,
  );
  const tab = useStoreWithNotebook((s) =>
    s.config.notebook.tabs.find((t) => t.id === currentTabId),
  );
  const addCell = useStoreWithNotebook((s) => s.notebook.addCell);
  const runAllCellsCascade = useStoreWithNotebook(
    (s) => s.notebook.runAllCellsCascade,
  );
  const run = useStoreWithNotebook((s) => s.notebook.runCell);

  const handleAddCellAndScroll = (type: NotebookCellTypes) => {
    if (!tab) return;
    addCell(tab.id, type);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentCellId) return;

      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        run(currentCellId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentCellId, run]);

  if (!tab) return null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <TabsBar />
      <div className="ml-auto mr-0 flex items-center gap-1 px-4 pt-2">
        <AddNewCellDropdown onAdd={handleAddCellAndScroll} enableShortcut />
        <Button
          size="xs"
          variant="secondary"
          onClick={() => runAllCellsCascade(tab.id)}
          className="h-7"
        >
          Run all
        </Button>
        <ShowInputBarToggle />
      </div>
      <InputBar
        inputBarOrder={tab.inputBarOrder}
        showInputBar={tab.showInputBar}
      />

      <div className="tab-scrollable-content flex flex-1 flex-col gap-1 overflow-auto px-6">
        {tab.cellOrder.map((id, index) => (
          <div className="flex flex-col space-y-1" key={`cellOrder-${id}`}>
            <AddNewCellTabs onAdd={(type) => addCell(tab.id, type, index)} />
            <CellView id={id} />
          </div>
        ))}
        <AddNewCellTabs onAdd={(type) => addCell(tab.id, type)} />
      </div>
    </div>
  );
};
