import {useEffect, useMemo, useState} from 'react';
import {formatTimeRelative} from '@sqlrooms/utils';
import {
  InputTypes,
  InputUnion,
  NotebookSliceConfig,
  NotebookTab,
  NotebookSheet,
} from './cellSchemas';
import type {CellsRootState, CellRegistry} from '@sqlrooms/cells';

export const findTab = (
  state: CellsRootState & {notebook: {config: NotebookSliceConfig}},
  tabId: string,
): NotebookTab => {
  const sheet = state.notebook.config.sheets[tabId];
  const cellsSheet = state.cells.config.sheets[tabId];
  if (!sheet || !cellsSheet) {
    throw new Error(`Tab with id ${tabId} not found`);
  }
  return {id: sheet.id, ...sheet.meta, name: cellsSheet.title};
};

export const findCellInNotebook = (
  state: CellsRootState & {notebook: {config: NotebookSliceConfig}},
  cellId: string,
) => {
  const cell = state.cells.config.data[cellId];
  if (!cell) return undefined;

  for (const [sheetId, sheet] of Object.entries(state.notebook.config.sheets)) {
    if ((sheet as NotebookSheet).meta.cellOrder.includes(cellId)) {
      return {cell, sheetId};
    }
  }
  return {cell, sheetId: undefined};
};

export const getCellTypeLabel = (type: string, registry?: CellRegistry) => {
  if (registry?.[type]) return registry[type].title;

  const typeToLabel: Record<string, string> = {
    sql: 'SQL',
    vega: 'Chart',
    text: 'Text',
    input: 'Input',
  };
  return typeToLabel[type] || type.charAt(0).toUpperCase() + type.slice(1);
};

export const initializeInput = (
  type: InputTypes,
  oldInput: InputUnion,
): InputUnion => {
  const name = oldInput.varName;
  switch (type) {
    case 'text':
      return {
        kind: 'text',
        varName: name,
        value: '',
      };
    case 'slider':
      return {
        kind: 'slider',
        varName: name,
        min: 0,
        max: 100,
        step: 1,
        value: 0,
      };
    case 'dropdown':
      return {
        kind: 'dropdown',
        varName: name,
        options: [],
        value: '',
      };
  }
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
