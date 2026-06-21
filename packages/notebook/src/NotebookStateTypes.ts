import type {NotebookCell, NotebookSliceConfig} from './cellSchemas';

export type NotebookSliceState = {
  notebook: {
    config: NotebookSliceConfig;
    schemaName: string;
    setSchemaName: (name: string) => void;
    ensureArtifact: (artifactId: string) => void;
    removeArtifact: (artifactId: string) => void;

    // Cell actions (delegate to cells, keep display order here)
    addCell: (
      artifactId: string,
      type: string,
      index?: number,
    ) => Promise<string>;
    moveCell: (
      artifactId: string,
      cellId: string,
      direction: 'up' | 'down',
    ) => void;
    removeCell: (cellId: string) => void;
    renameCell: (cellId: string, name: string) => void;
    updateCell: (
      cellId: string,
      updater: (cell: NotebookCell) => NotebookCell,
    ) => void;
    setCurrentCell: (id: string) => void;

    // Execution delegates to cells
    runCell: (cellId: string, opts?: {cascade?: boolean}) => Promise<void>;
    runAllCells: (artifactId: string) => Promise<void>;
    runAllCellsCascade: (artifactId: string) => Promise<void>;
    cancelRunCell: (cellId: string) => void;
  };
};
