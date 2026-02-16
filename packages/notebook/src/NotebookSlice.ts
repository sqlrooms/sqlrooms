import {createId} from '@paralleldrive/cuid2';
import {
  type CellsSliceState,
  type Cell,
  getSheetsByType,
} from '@sqlrooms/cells';
import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {generateUniqueName} from '@sqlrooms/utils';
import {produce} from 'immer';
import {NotebookCell, NotebookSliceConfig} from './cellSchemas';
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

          getNotebookSheets: () => getSheetsByType(get(), 'notebook'),

          addTab: (title) => {
            const existingTitles = Object.values(get().cells.config.sheets).map(
              (s) => s.title,
            );
            const finalTitle =
              title || generateUniqueName('Notebook 1', existingTitles, ' ');
            const id = get().cells.addSheet(finalTitle, 'notebook');
            set((state) =>
              produce(state, (draft) => {
                draft.notebook.config.sheets[id] = {
                  id,
                  meta: {
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

          initializeSheet: (id) => {
            set((state) =>
              produce(state, (draft) => {
                if (!draft.notebook.config.sheets[id]) {
                  draft.notebook.config.sheets[id] = {
                    id,
                    meta: {
                      cellOrder: [],
                      inputBarOrder: [],
                      showInputBar: true,
                    },
                  };
                }
              }),
            );
          },

          addCell: async (tabId, type, index) => {
            const id = createId();
            const reg = get().cells.cellRegistry[type];
            if (!reg) return id;

            const cell = reg.createCell(id) as Cell;

            // Assign a readable unique name using shared utility
            const allCells = Object.values(get().cells.config.data);
            const usedNames = allCells
              .map((c) => {
                const title = (c.data as Record<string, unknown>).title;
                return typeof title === 'string' ? title : undefined;
              })
              .filter((v): v is string => Boolean(v));
            const baseLabel = getCellTypeLabel(cell.type);
            if (baseLabel) {
              const current = cell.data as Record<string, unknown>;
              current.title = generateUniqueName(
                `${baseLabel} 1`,
                usedNames,
                ' ',
              );
            }

            if (type === 'input') {
              const usedInputNames = allCells
                .filter((c) => c.type === 'input')
                .map(
                  (c) =>
                    (c.data as {input?: {varName?: string}}).input?.varName ??
                    '',
                )
                .filter((name) => Boolean(name));
              if (cell.type === 'input') {
                cell.data.input.varName = generateUniqueName(
                  cell.data.input.varName,
                  usedInputNames,
                );
              }
            }

            await get().cells.addCell(tabId, cell, index);

            set((state) =>
              produce(state, (draft) => {
                let sheet = getSheet(draft.notebook.config, tabId);
                if (!sheet) {
                  // Initialize metadata if needed
                  sheet = {
                    id: tabId,
                    meta: {
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
            void get().cells.updateCell(cellId, (cell) => ({
              ...cell,
              data: {...cell.data, title: name},
            }));
          },

          updateCell: (cellId, updater) => {
            void get().cells.updateCell(cellId, (cell) => {
              return updater(cell as NotebookCell) as Cell;
            });
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
            await get().cells.runAllCellsCascade(tabId);
          },

          runCell: async (cellId, opts) => {
            await get().cells.runCell(cellId, opts);
          },
        },
      };
    },
  );
}
