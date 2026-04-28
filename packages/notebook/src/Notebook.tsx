import {Button} from '@sqlrooms/ui';
import React, {useEffect, useMemo} from 'react';

import {AddNewCellDropdown} from './cellOperations/AddNewCellDropdown';
import {AddNewCellTabs} from './cellOperations/AddNewCellTabs';
import {CellView} from './cells/CellView';
import {useStoreWithNotebook} from './useStoreWithNotebook';

export const Notebook: React.FC<{artifactId: string}> = ({artifactId}) => {
  const currentCellId = useStoreWithNotebook(
    (s) => s.notebook.config.currentCellId,
  );
  const sheet = useStoreWithNotebook(
    (s) => s.notebook.config.artifacts[artifactId],
  );
  const cellsSheet = useStoreWithNotebook(
    (s) => s.cells.config.artifacts[artifactId],
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
    };
    return {id: cellsSheet.id, ...meta, name: artifactId, cellOrder};
  }, [artifactId, sheet, cellsSheet, cellOrder]);

  const addCell = useStoreWithNotebook((s) => s.notebook.addCell);
  const runAllCellsCascade = useStoreWithNotebook(
    (s) => s.notebook.runAllCellsCascade,
  );
  const run = useStoreWithNotebook((s) => s.notebook.runCell);
  const ensureArtifact = useStoreWithNotebook((s) => s.notebook.ensureArtifact);

  const handleAddCellAndScroll = (type: string) => {
    addCell(artifactId, type);
  };

  useEffect(() => {
    if (!sheet || !cellsSheet) {
      ensureArtifact(artifactId);
    }
  }, [artifactId, cellsSheet, ensureArtifact, sheet]);

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

  if (!cellsSheet) {
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
      <div className="mr-0 ml-auto flex items-center gap-1 px-4 pt-2">
        <AddNewCellDropdown
          artifactId={artifactId}
          onAdd={handleAddCellAndScroll}
          enableShortcut
        />
        <Button
          size="xs"
          variant="secondary"
          onClick={() => runAllCellsCascade(tab.id)}
          className="h-7"
        >
          Run all
        </Button>
      </div>

      <div className="tab-scrollable-content flex flex-1 flex-col gap-1 overflow-auto px-6">
        {tab.cellOrder.map((id: string, index: number) => (
          <div
            className="flex flex-col space-y-1"
            // Include the index so moving a cell remounts Monaco cleanly.
            key={`cellOrder-${id}-${index}`}
          >
            <AddNewCellTabs
              artifactId={artifactId}
              onAdd={(type) => addCell(tab.id, type, index)}
            />
            <CellView id={id} />
          </div>
        ))}
        <AddNewCellTabs
          artifactId={artifactId}
          onAdd={(type) => addCell(tab.id, type)}
        />
      </div>
    </div>
  );
};
