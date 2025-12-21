import {createId} from '@paralleldrive/cuid2';
import {
  type CellsSliceState,
  type DagSliceState,
  type Cell,
} from '@sqlrooms/cells';
import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-shell';
import {generateUniqueName} from '@sqlrooms/utils';
import {produce} from 'immer';
import React from 'react';
import {InputCell} from './cells/Input/InputCell';
import {SqlCell} from './cells/SqlCell';
import {TextCell} from './cells/TextCell';
import {VegaCell} from './cells/Vega/VegaCell';
import {
  NotebookCell,
  NotebookCellTypes,
  NotebookSliceConfig,
} from './cellSchemas';
import {getCellTypeLabel} from './NotebookUtils';
import type {NotebookSliceState} from './NotebookStateTypes';

/**
 * Create default `notebook.config` structure with no cells.
 */
export function createDefaultNotebookConfig(
  props: Partial<NotebookSliceConfig> = {},
): NotebookSliceConfig {
  const base: NotebookSliceConfig = {
    sheets: {},
    currentCellId: undefined,
  };

  // If already a DAG config, merge over the base
  return {...base, ...props};
}

function getSheet(config: NotebookSliceConfig, sheetId: string) {
  return config.sheets[sheetId];
}

function findSheetIdByCellId(
  config: NotebookSliceConfig,
  cellId: string,
): string | undefined {
  for (const [sheetId, sheet] of Object.entries(config.sheets)) {
    if (sheet?.meta.cellOrder.includes(cellId)) {
      return sheetId;
    }
  }
  return undefined;
}

/**
 * Create the Notebook slice with tabs, cells, execution and dependency handling.
 * Supports pluggable custom renderers via options.
 */
export function createNotebookSlice(props?: {
  config?: Partial<NotebookSliceConfig>;
}) {
  type NotebookRootState = BaseRoomStoreState &
    DuckDbSliceState &
    NotebookSliceState &
    DagSliceState &
    CellsSliceState;

  return createSlice<NotebookSliceState, NotebookRootState>(
    (set, get, _store) => {
      return {
        notebook: {
          schemaName: 'notebook',

          config: createDefaultNotebookConfig(props?.config ?? {}),

          setSchemaName: (name) =>
            set((state) =>
              produce(state, (draft) => {
                draft.notebook.schemaName = name;
              }),
            ),

          addTab: (title) => {
            const id = get().cells.addSheet(title);
            set((state) =>
              produce(state, (draft) => {
                draft.notebook.config.sheets[id] = {
                  id,
                  meta: {
                    title:
                      title ||
                      `Notebook ${Object.keys(draft.notebook.config.sheets).length + 1}`,
                    cellOrder: [],
                    inputBarOrder: [],
                    showInputBar: true,
                  },
                };
              }),
            );
            return id;
          },

          renameTab: (id, title) => {
            get().cells.renameSheet(id, title);
            set((state) =>
              produce(state, (draft) => {
                const sheet = getSheet(draft.notebook.config, id);
                if (sheet) sheet.meta.title = title;
              }),
            );
          },

          setCurrentTab: (id) => {
            get().cells.setCurrentSheet(id);
          },

          removeTab: (id) => {
            get().cells.removeSheet(id);
            set((state) =>
              produce(state, (draft) => {
                delete draft.notebook.config.sheets[id];
              }),
            );
          },

          toggleShowInputBar: (id) => {
            set((state) =>
              produce(state, (draft) => {
                const sheet = getSheet(draft.notebook.config, id);
                if (sheet) sheet.meta.showInputBar = !sheet.meta.showInputBar;
              }),
            );
          },

          addCell: (tabId, type, index) => {
            const id = createId();
            const reg = get().notebook.cellRegistry[type];
            if (!reg) return id;

            const cell = reg.createCell(id) as Cell;

            // Assign a readable unique name using shared utility
            const allCells = Object.values(get().cells.config.data);
            const usedNames = allCells.map((c) => (c.data as any).title);
            const baseLabel = getCellTypeLabel(cell.type);
            if (baseLabel) {
              (cell.data as any).title = generateUniqueName(
                baseLabel,
                usedNames,
              );
            }

            if (type === 'input') {
              const usedInputNames = allCells
                .filter((c) => c.type === 'input')
                .map((c) => (c as any).data.input.varName);
              (cell as any).data.input.varName = generateUniqueName(
                (cell as any).data.input.varName,
                usedInputNames,
              );
            }

            get().cells.addCell(tabId, cell, index);

            set((state) =>
              produce(state, (draft) => {
                let sheet = getSheet(draft.notebook.config, tabId);
                if (!sheet) {
                  // Initialize metadata if needed
                  sheet = {
                    id: tabId,
                    meta: {
                      title: 'Notebook',
                      cellOrder: [],
                      inputBarOrder: [],
                      showInputBar: true,
                    },
                  };
                  draft.notebook.config.sheets[tabId] = sheet;
                }

                // cellOrder
                const newIndex = index ?? sheet.meta.cellOrder.length;
                sheet.meta.cellOrder.splice(newIndex, 0, id);

                // inputBarOrder
                if (type === 'input') {
                  sheet.meta.inputBarOrder.splice(newIndex, 0, id);
                }

                draft.notebook.config.currentCellId = id;
              }),
            );
            return id;
          },

          moveCell: (tabId, cellId, direction) => {
            set((state) =>
              produce(state, (draft) => {
                const sheet = getSheet(draft.notebook.config, tabId);
                if (!sheet) return;

                const idx = sheet.meta.cellOrder.indexOf(cellId);
                if (idx >= 0) {
                  const newIndex = direction === 'up' ? idx - 1 : idx + 1;
                  if (newIndex < 0 || newIndex >= sheet.meta.cellOrder.length)
                    return;

                  sheet.meta.cellOrder.splice(idx, 1);
                  sheet.meta.cellOrder.splice(newIndex, 0, cellId);
                }
              }),
            );
          },

          removeCell: (cellId) => {
            get().cells.removeCell(cellId);
            set((state) =>
              produce(state, (draft) => {
                const sheetId = findSheetIdByCellId(
                  draft.notebook.config,
                  cellId,
                );
                if (!sheetId) return;
                const sheet = getSheet(draft.notebook.config, sheetId);
                if (!sheet) return;

                sheet.meta.cellOrder = sheet.meta.cellOrder.filter(
                  (id) => id !== cellId,
                );
                sheet.meta.inputBarOrder = sheet.meta.inputBarOrder.filter(
                  (id) => id !== cellId,
                );
              }),
            );
          },

          renameCell: (cellId, name) => {
            get().cells.updateCell(cellId, (cell) => {
              const newCell = {...cell};
              (newCell.data as any).title = name;
              return newCell;
            });
          },

          updateCell: (cellId, updater) => {
            get().cells.updateCell(cellId, updater as any);
          },

          setCurrentCell: (id) => {
            set((state) =>
              produce(state, (draft) => {
                draft.notebook.config.currentCellId = id;
              }),
            );
          },

          cancelRunCell: (cellId) => {
            get().cells.cancelCell(cellId);
          },

          runAllCells: async (tabId) => {
            const sheet = getSheet(get().notebook.config, tabId);
            if (!sheet) return;
            for (const cellId of sheet.meta.cellOrder) {
              await get().cells.runCell(cellId, {cascade: false});
            }
          },

          runAllCellsCascade: async (tabId) => {
            await get().dag.runAllCellsCascade(tabId);
          },

          runCell: async (cellId, opts) => {
            await get().cells.runCell(cellId, opts);
          },

          cellRegistry: {
            sql: {
              title: 'SQL',
              createCell: (id) =>
                ({
                  id,
                  type: 'sql',
                  data: {title: 'SQL', sql: ''},
                }) as NotebookCell,
              renderComponent: (id: string) =>
                React.createElement(SqlCell, {id}),
              findDependencies: () => [], // Dependencies are now handled by edges in CellsSlice
            },
            text: {
              title: 'Text',
              createCell: (id) =>
                ({
                  id,
                  type: 'text',
                  data: {title: 'Text', text: ''},
                }) as NotebookCell,
              renderComponent: (id: string) =>
                React.createElement(TextCell, {id}),
              findDependencies: () => [],
            },
            vega: {
              title: 'Vega',
              createCell: (id) =>
                ({
                  id,
                  type: 'vega',
                  data: {title: 'Chart', sqlId: ''},
                }) as NotebookCell,
              renderComponent: (id: string) =>
                React.createElement(VegaCell, {id}),
              findDependencies: () => [],
            },
            input: {
              title: 'Input',
              createCell: (id) =>
                ({
                  id,
                  type: 'input',
                  data: {
                    title: 'Input',
                    input: {kind: 'text', varName: 'input_1', value: ''},
                  },
                }) as NotebookCell,
              renderComponent: (id: string) =>
                React.createElement(InputCell, {id}),
              findDependencies: () => [],
            },
          },
        },
      };
    },
  );
}
