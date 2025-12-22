import {createId} from '@paralleldrive/cuid2';
import {createSlice} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import {executeSqlCell} from './execution';
import type {
  Cell,
  CellRegistry,
  CellsRootState,
  CellsSliceState,
  Edge,
  SheetType,
} from './types';

export {createDagSlice} from './dagSlice';
export type {CellsRootState} from './types';

/**
 * Finds the sheet ID that contains the given cell ID.
 */
export function findSheetIdForCell(
  state: CellsRootState,
  cellId: string,
): string | undefined {
  for (const [id, sheet] of Object.entries(state.cells.config.sheets)) {
    if (sheet.cellIds.includes(cellId)) {
      return id;
    }
  }
  return undefined;
}

/**
 * Gets all sheets of a specific type.
 */
export function getSheetsByType(
  state: CellsRootState,
  type: SheetType,
): Record<string, import('./types').Sheet> {
  const sheets: Record<string, import('./types').Sheet> = {};
  for (const [id, sheet] of Object.entries(state.cells.config.sheets)) {
    if (sheet.type === type) {
      sheets[id] = sheet;
    }
  }
  return sheets;
}

// --- Slice Implementation ---

export function createCellsSlice(props: {cellRegistry: CellRegistry}) {
  return createSlice<CellsSliceState, CellsRootState>((set, get, store) => {
    return {
      cells: {
        cellRegistry: props.cellRegistry,
        config: {
          data: {},
          sheets: {},
          sheetOrder: [],
          currentSheetId: undefined,
        },
        status: {},
        activeAbortControllers: {},

        addCell: (sheetId: string, cell: Cell, index?: number) => {
          set((state) =>
            produce(state, (draft) => {
              draft.cells.config.data[cell.id] = cell;
              if (cell.type === 'sql') {
                draft.cells.status[cell.id] = {
                  type: 'sql',
                  status: 'idle',
                  referencedTables: [],
                };
              } else {
                draft.cells.status[cell.id] = {type: 'other'};
              }

              let sheet = draft.cells.config.sheets[sheetId];
              if (!sheet) {
                sheet = {
                  id: sheetId,
                  type: 'notebook',
                  title: 'Sheet',
                  cellIds: [],
                  edges: [],
                };
                draft.cells.config.sheets[sheetId] = sheet;
                draft.cells.config.sheetOrder.push(sheetId);
                if (!draft.cells.config.currentSheetId) {
                  draft.cells.config.currentSheetId = sheetId;
                }
              }

              const newIndex =
                index !== undefined ? index : sheet.cellIds.length;
              sheet.cellIds.splice(newIndex, 0, cell.id);

              // Auto-derive edges from dependencies
              const deps =
                props.cellRegistry[cell.type]?.findDependencies({
                  cell,
                  cells: draft.cells.config.data as Record<string, Cell>,
                  sheetId,
                }) ?? [];
              for (const depId of deps) {
                sheet.edges.push({
                  id: `${depId}-${cell.id}`,
                  source: depId,
                  target: cell.id,
                });
              }
            }),
          );
        },

        removeCell: (id: string) => {
          set((state) =>
            produce(state, (draft) => {
              delete draft.cells.config.data[id];
              delete draft.cells.status[id];
              const controller = draft.cells.activeAbortControllers[id];
              if (controller) {
                controller.abort();
                delete draft.cells.activeAbortControllers[id];
              }

              // Remove from all sheets
              for (const sheet of Object.values(draft.cells.config.sheets)) {
                sheet.cellIds = sheet.cellIds.filter((cid) => cid !== id);
                sheet.edges = sheet.edges.filter(
                  (e) => e.source !== id && e.target !== id,
                );
              }
            }),
          );
        },

        updateCell: (id: string, updater: (cell: Cell) => Cell) => {
          set((state) =>
            produce(state, (draft) => {
              const cell = draft.cells.config.data[id];
              if (cell) {
                const updatedCell = updater(cell);
                draft.cells.config.data[id] = updatedCell;

                // Update edges in all sheets this cell belongs to
                const newDeps =
                  props.cellRegistry[updatedCell.type]?.findDependencies({
                    cell: updatedCell,
                    cells: draft.cells.config.data as Record<string, Cell>,
                    sheetId: '', // sheetId not needed for dependency derivation usually
                  }) ?? [];

                for (const sheet of Object.values(draft.cells.config.sheets)) {
                  if (sheet.cellIds.includes(id)) {
                    // Remove old edges for this target
                    sheet.edges = sheet.edges.filter((e) => e.target !== id);
                    // Add new ones
                    for (const depId of newDeps) {
                      sheet.edges.push({
                        id: `${depId}-${id}`,
                        source: depId,
                        target: id,
                      });
                    }
                  }
                }
              }
            }),
          );
          // After update, trigger cascade
          const cell = get().cells.config.data[id];
          if (cell) {
            for (const sheetId of get().cells.config.sheetOrder) {
              const sheet = get().cells.config.sheets[sheetId];
              if (sheet?.cellIds.includes(id)) {
                void get().dag.runDownstreamCascade(sheetId, id);
              }
            }
          }
        },

        addSheet: (title?: string, type: SheetType = 'notebook') => {
          const id = createId();
          set((state) =>
            produce(state, (draft) => {
              draft.cells.config.sheets[id] = {
                id,
                type,
                title:
                  title || `Sheet ${draft.cells.config.sheetOrder.length + 1}`,
                cellIds: [],
                edges: [],
              };
              draft.cells.config.sheetOrder.push(id);
              if (!draft.cells.config.currentSheetId) {
                draft.cells.config.currentSheetId = id;
              }
            }),
          );
          return id;
        },

        removeSheet: (sheetId: string) => {
          set((state) =>
            produce(state, (draft) => {
              delete draft.cells.config.sheets[sheetId];
              draft.cells.config.sheetOrder =
                draft.cells.config.sheetOrder.filter((id) => id !== sheetId);
              if (draft.cells.config.currentSheetId === sheetId) {
                draft.cells.config.currentSheetId =
                  draft.cells.config.sheetOrder[0];
              }
            }),
          );
        },

        renameSheet: (sheetId: string, title: string) => {
          set((state) =>
            produce(state, (draft) => {
              const sheet = draft.cells.config.sheets[sheetId];
              if (sheet) {
                // We could add validation here, but usually UI handles it.
                // For now, we'll just allow it as the primary logic is in view slices.
                sheet.title = title;
              }
            }),
          );
        },

        setCurrentSheet: (sheetId: string) => {
          set((state) =>
            produce(state, (draft) => {
              draft.cells.config.currentSheetId = sheetId;
            }),
          );
        },

        addEdge: (sheetId: string, edge: Omit<Edge, 'id'>) => {
          set((state) =>
            produce(state, (draft) => {
              let sheet = draft.cells.config.sheets[sheetId];
              if (!sheet) {
                sheet = {
                  id: sheetId,
                  type: 'notebook',
                  title: 'Sheet',
                  cellIds: [],
                  edges: [],
                };
                draft.cells.config.sheets[sheetId] = sheet;
                draft.cells.config.sheetOrder.push(sheetId);
                if (!draft.cells.config.currentSheetId) {
                  draft.cells.config.currentSheetId = sheetId;
                }
              }
              const id = `${edge.source}-${edge.target}`;
              if (!sheet.edges.find((e) => e.id === id)) {
                sheet.edges.push({...edge, id});
              }
            }),
          );
        },

        removeEdge: (sheetId: string, edgeId: string) => {
          set((state) =>
            produce(state, (draft) => {
              const sheet = draft.cells.config.sheets[sheetId];
              if (sheet) {
                sheet.edges = sheet.edges.filter((e) => e.id !== edgeId);
              }
            }),
          );
        },

        updateEdgesFromSql: (sheetId: string, cellId: string) => {
          set((state) =>
            produce(state, (draft) => {
              const cell = draft.cells.config.data[cellId];
              const sheet = draft.cells.config.sheets[sheetId];
              if (cell && sheet) {
                const deps =
                  props.cellRegistry[cell.type]?.findDependencies({
                    cell,
                    cells: draft.cells.config.data as Record<string, Cell>,
                    sheetId,
                  }) ?? [];
                sheet.edges = sheet.edges.filter((e) => e.target !== cellId);
                for (const depId of deps) {
                  sheet.edges.push({
                    id: `${depId}-${cellId}`,
                    source: depId,
                    target: cellId,
                  });
                }
              }
            }),
          );
        },

        runCell: async (
          id: string,
          opts?: {cascade?: boolean; schemaName?: string},
        ) => {
          const state = get();
          const cell = state.cells.config.data[id];
          if (!cell) return;

          const registryItem = props.cellRegistry[cell.type];
          if (!registryItem) return;

          if (registryItem.runCell) {
            await registryItem.runCell({id, opts});
            return;
          }

          // Default behavior for SQL cells if no runCell provided in registry
          if (cell.type === 'sql') {
            const controller = new AbortController();
            set((s) =>
              produce(s, (draft) => {
                draft.cells.activeAbortControllers[id] = controller;
              }),
            );

            await executeSqlCell(id, get, set, {
              schemaName: opts?.schemaName || 'main',
              cascade: opts?.cascade,
              signal: controller.signal,
            });
          }
        },
        cancelCell: (id: string) => {
          const state = get();
          const controller = state.cells.activeAbortControllers[id];
          if (controller) {
            controller.abort();
          }
        },
      },
    };
  });
}
