import {Button} from '@sqlrooms/ui';
import React, {useEffect, useMemo} from 'react';

import {useStoreWithNotebook} from './useStoreWithNotebook';
import {AddNewCellDropdown} from './cellOperations/AddNewCellDropdown';
import {AddNewCellTabs} from './cellOperations/AddNewCellTabs';
import {InputBar, ShowInputBarToggle} from './cells/InputBar';
import {CellView} from './cells/CellView';

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
    if (!cellsSheet) return [] as string[];
    const metaCellOrder = sheet?.meta.cellOrder || [];
    // Use notebook's cellOrder but ensure all cells from canonical sheet are present
    const ordered = metaCellOrder.filter((id) =>
      cellsSheet.cellIds.includes(id),
    );
    const missing = cellsSheet.cellIds.filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  }, [sheet, cellsSheet]);

  const tab = useMemo(() => {
    if (!cellsSheet) return undefined;
    const meta = sheet?.meta || {
      cellOrder: [],
      inputBarOrder: [],
      showInputBar: true,
    };
    return {id: cellsSheet.id, ...meta, name: cellsSheet.title, cellOrder};
  }, [sheet, cellsSheet, cellOrder]);

  const addCell = useStoreWithNotebook((s) => s.notebook.addCell);
  const runAllCellsCascade = useStoreWithNotebook(
    (s) => s.notebook.runAllCellsCascade,
  );
  const run = useStoreWithNotebook((s) => s.notebook.runCell);
  const initializeSheet = useStoreWithNotebook(
    (s) => s.notebook.initializeSheet,
  );

  const handleAddCellAndScroll = (type: string) => {
    if (!currentTabId) return;
    addCell(currentTabId, type);
  };

  useEffect(() => {
    if (currentTabId && cellsSheet?.type === 'notebook' && !sheet) {
      initializeSheet(currentTabId);
    }
  }, [currentTabId, cellsSheet, sheet, initializeSheet]);

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

  if (!cellsSheet || cellsSheet.type !== 'notebook') {
    return null;
  }

  if (!tab) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center">
        Initializing sheet metadata...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="ml-auto mr-0 flex items-center gap-1 px-4 pt-2">
        {tab.inputBarOrder.length > 0 ? (
          <ShowInputBarToggle inputBarOrder={tab.inputBarOrder} />
        ) : null}
        <AddNewCellDropdown onAdd={handleAddCellAndScroll} enableShortcut />
        <Button
          size="xs"
          variant="secondary"
          onClick={() => runAllCellsCascade(tab.id)}
          className="h-7"
        >
          Run all
        </Button>
      </div>
      <InputBar
        inputBarOrder={tab.inputBarOrder}
        showInputBar={tab.showInputBar}
      />

      <div className="tab-scrollable-content flex flex-1 flex-col gap-1 overflow-auto px-6">
        {tab.cellOrder.map((id: string, index: number) => (
          <div
            className="flex flex-col space-y-1"
            // Include the index so moving a cell remounts Monaco cleanly.
            key={`cellOrder-${id}-${index}`}
          >
            <AddNewCellTabs onAdd={(type) => addCell(tab.id, type, index)} />
            <CellView id={id} />
          </div>
        ))}
        <AddNewCellTabs onAdd={(type) => addCell(tab.id, type)} />
      </div>
    </div>
  );
};
