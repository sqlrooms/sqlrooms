import {Button, TabStrip} from '@sqlrooms/ui';
import React, {useEffect, useMemo} from 'react';
import {PencilIcon, PlusIcon, TrashIcon} from 'lucide-react';

import {useStoreWithNotebook} from './useStoreWithNotebook';
import {AddNewCellDropdown} from './cellOperations/AddNewCellDropdown';
import {NotebookCellTypes} from './cellSchemas';
import {AddNewCellTabs} from './cellOperations/AddNewCellTabs';
import {InputBar, ShowInputBarToggle} from './cells/InputBar';
import {CellView} from './cells/CellView';

export const SheetsTabBar: React.FC = () => {
  const sheetOrder = useStoreWithNotebook((s) => s.cells.config.sheetOrder);
  const sheets = useStoreWithNotebook((s) => s.cells.config.sheets);
  const currentSheetId = useStoreWithNotebook(
    (s) => s.cells.config.currentSheetId,
  );

  const notebookSheetOrder = useMemo(
    () => sheetOrder.filter((id) => sheets[id]?.type === 'notebook'),
    [sheetOrder, sheets],
  );

  const tabs = useMemo(
    () =>
      notebookSheetOrder.map((id) => {
        const sheet = sheets[id];
        return {
          id,
          name: sheet?.title || 'Sheet',
        };
      }),
    [notebookSheetOrder, sheets],
  );

  const setCurrent = useStoreWithNotebook((s) => s.notebook.setCurrentTab);
  const addTab = useStoreWithNotebook((s) => s.notebook.addTab);
  const renameTab = useStoreWithNotebook((s) => s.notebook.renameTab);
  const removeTab = useStoreWithNotebook((s) => s.notebook.removeTab);

  return (
    <TabStrip
      tabs={tabs}
      openTabs={notebookSheetOrder}
      selectedTabId={currentSheetId}
      onSelect={setCurrent}
      onCreate={() => addTab()}
      onRename={renameTab}
      onClose={removeTab}
      renderTabMenu={(tab) => (
        <>
          <TabStrip.MenuItem onClick={() => renameTab(tab.id, tab.name)}>
            <PencilIcon className="mr-2 h-4 w-4" />
            Rename
          </TabStrip.MenuItem>
          <TabStrip.MenuSeparator />
          <TabStrip.MenuItem
            variant="destructive"
            onClick={() => removeTab(tab.id)}
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </TabStrip.MenuItem>
        </>
      )}
    />
  );
};

export const Notebook: React.FC = () => {
  const currentTabId = useStoreWithNotebook(
    (s) => s.cells.config.currentSheetId,
  );
  const currentCellId = useStoreWithNotebook(
    (s) => s.notebook.config.currentCellId,
  );
  const sheet = useStoreWithNotebook((s) =>
    currentTabId ? s.notebook.config.sheets[currentTabId] : undefined,
  );
  const cellsSheet = useStoreWithNotebook((s) =>
    currentTabId ? s.cells.config.sheets[currentTabId] : undefined,
  );

  const cellOrder = useMemo(() => {
    if (!sheet || !cellsSheet) return [] as string[];
    // Use notebook's cellOrder but ensure all cells from canonical sheet are present
    const ordered = sheet.meta.cellOrder.filter((id) =>
      cellsSheet.cellIds.includes(id),
    );
    const missing = cellsSheet.cellIds.filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  }, [sheet, cellsSheet]);

  const tab = useMemo(() => {
    if (!sheet || !cellsSheet) return undefined;
    return {id: sheet.id, ...sheet.meta, name: cellsSheet.title, cellOrder};
  }, [sheet, cellsSheet, cellOrder]);

  const addCell = useStoreWithNotebook((s) => s.notebook.addCell);
  const addTab = useStoreWithNotebook((s) => s.notebook.addTab);
  const runAllCellsCascade = useStoreWithNotebook(
    (s) => s.notebook.runAllCellsCascade,
  );
  const run = useStoreWithNotebook((s) => s.notebook.runCell);

  const handleAddCellAndScroll = (type: NotebookCellTypes) => {
    if (!currentTabId) return;
    addCell(currentTabId, type);
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

  if (!currentTabId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">No sheets yet</p>
        <Button onClick={() => addTab()}>Create first sheet</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SheetsTabBar />
      {tab ? (
        <>
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
            {tab.cellOrder.map((id: string, index: number) => (
              <div className="flex flex-col space-y-1" key={`cellOrder-${id}`}>
                <AddNewCellTabs
                  onAdd={(type) => addCell(tab.id, type, index)}
                />
                <CellView id={id} />
              </div>
            ))}
            <AddNewCellTabs onAdd={(type) => addCell(tab.id, type)} />
          </div>
        </>
      ) : (
        <div className="text-muted-foreground flex flex-1 items-center justify-center">
          Initializing sheet metadata...
        </div>
      )}
    </div>
  );
};
