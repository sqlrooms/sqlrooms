import {useEffect, useMemo, useState} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';
import {
  NotebookSliceConfig,
  NotebookArtifactView,
  NotebookArtifact,
} from './cellSchemas';
import type {CellsRootState, CellRegistry} from '@sqlrooms/cells';

export const findNotebookArtifactView = (
  state: CellsRootState & {notebook: {config: NotebookSliceConfig}},
  artifactId: string,
): NotebookArtifactView => {
  const artifact = state.notebook.config.artifacts[artifactId];
  const cellsArtifact = state.cells.config.artifacts[artifactId];
  if (!artifact || !cellsArtifact) {
    throw new Error(`Artifact with id ${artifactId} not found`);
  }
  return {id: artifact.id, ...artifact.meta, name: artifactId};
};

export const findCellInNotebook = (
  state: CellsRootState & {notebook: {config: NotebookSliceConfig}},
  cellId: string,
) => {
  const cell = state.cells.config.data[cellId];
  if (!cell) return undefined;

  for (const [artifactId, artifact] of Object.entries(
    state.notebook.config.artifacts,
  )) {
    if ((artifact as NotebookArtifact).meta.cellOrder.includes(cellId)) {
      return {cell, artifactId};
    }
  }
  return {cell, artifactId: undefined};
};

export const getCellTypeLabel = (type: string, registry?: CellRegistry) => {
  if (registry?.[type]) return registry[type].title;

  const typeToLabel: Record<string, string> = {
    sql: 'SQL',
    vega: 'Chart',
    text: 'Text',
    input: 'Input',
    pivot: 'Pivot',
  };
  return typeToLabel[type] || type.charAt(0).toUpperCase() + type.slice(1);
};

export function useRelativeTimeDisplay(pastDate: number | null): string {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!pastDate) return;
    const interval = setInterval(() => setTick((value) => value + 1), 60000);
    return () => clearInterval(interval);
  }, [pastDate]);

  return useMemo(() => formatTimeRelative(pastDate), [pastDate, tick]);
}
