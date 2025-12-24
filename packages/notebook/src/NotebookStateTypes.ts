import type React from 'react';
import type {CellStatus} from '@sqlrooms/cells';
import type {NotebookCell, NotebookSliceConfig} from './cellSchemas';

export type NotebookSliceState = {
  notebook: {
    config: NotebookSliceConfig;
    schemaName: string;
    setSchemaName: (name: string) => void;
    getNotebookSheets: () => Record<string, import('@sqlrooms/cells').Sheet>;

    // Sheet actions (delegate to cells for the sheet itself, keep view meta here)
    addTab: (title?: string) => string;
    renameTab: (id: string, title: string) => void;
    setCurrentTab: (id: string) => void;
    removeTab: (id: string) => void;
    toggleShowInputBar: (id: string) => void;
    initializeSheet: (id: string) => void;

    // Cell actions (delegate to cells, keep display order here)
    addCell: (tabId: string, type: string, index?: number) => string;
    moveCell: (tabId: string, cellId: string, direction: 'up' | 'down') => void;
    removeCell: (cellId: string) => void;
    renameCell: (cellId: string, name: string) => void;
    updateCell: (
      cellId: string,
      updater: (cell: NotebookCell) => NotebookCell,
    ) => void;
    setCurrentCell: (id: string) => void;

    // Execution delegates to cells
    runCell: (cellId: string, opts?: {cascade?: boolean}) => Promise<void>;
    runAllCells: (tabId: string) => Promise<void>;
    runAllCellsCascade: (tabId: string) => Promise<void>;
    cancelRunCell: (cellId: string) => void;
  };
};
