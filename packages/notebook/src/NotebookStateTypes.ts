import type React from 'react';

import type {
  NotebookCell,
  NotebookCellTypes,
  NotebookSliceConfig,
} from './cellSchemas';

export type NotebookCellRegistryItem = {
  title: string;
  createCell: (id: string) => NotebookCell;
  renderComponent: (id: string) => React.ReactElement;
  findDependencies: (
    cell: NotebookCell,
    cells: Record<string, NotebookCell>,
    status: NotebookSliceState['notebook']['cellStatus'],
  ) => string[];
  runCell?: (args: {id: string; opts?: {cascade?: boolean}}) => Promise<void>;
};

export type CellRegistry = Record<string, NotebookCellRegistryItem>;

export type NotebookSliceState = {
  notebook: {
    config: NotebookSliceConfig;
    schemaName: string;
    setSchemaName: (name: string) => void;
    addTab: () => string;
    renameTab: (id: string, title: string) => void;
    setCurrentTab: (id: string) => void;
    removeTab: (id: string) => void;
    toggleShowInputBar: (id: string) => void;

    addCell: (tabId: string, type: NotebookCellTypes, index?: number) => string;
    moveCell: (tabId: string, cellId: string, direction: 'up' | 'down') => void;
    removeCell: (cellId: string) => void;
    renameCell: (cellId: string, name: string) => void;
    updateCell: (
      cellId: string,
      updater: (cell: NotebookCell) => NotebookCell,
    ) => void;
    setCurrentCell: (id: string) => void;

    runCell: (cellId: string, opts?: {cascade?: boolean}) => Promise<void>;
    runAllCells: (tabId: string) => Promise<void>;
    runAllCellsCascade: (tabId: string) => Promise<void>;
    cancelRunCell: (cellId: string) => void;

    cellRegistry: Record<string, NotebookCellRegistryItem>;

    cellStatus: Record<
      string,
      | {
          type: 'sql';
          status: 'idle' | 'running' | 'success' | 'cancel' | 'error';
          lastError?: string;
          referencedTables?: string[];
          resultView?: string;
          resultName?: string;
          lastRunTime?: number;
        }
      | {
          type: 'other';
        }
    >;

    activeAbortControllers: Record<string, AbortController>;
  };
};
