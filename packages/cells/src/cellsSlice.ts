import {createId} from '@paralleldrive/cuid2';
import {createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {generateUniqueName} from '@sqlrooms/utils';
import {
  buildDependencyGraph,
  buildDependencyGraphAsync,
  collectReachable,
  topologicalOrder,
} from './dagUtils';
import type {
  Cell,
  CellRegistry,
  CellsRootState,
  CellsSliceOptions,
  CellsSliceState,
  Edge,
  SheetType,
  SqlSelectToJsonFn,
} from './types';

/**
 * Helper to resolve dependencies using async method if available, falling back to sync.
 */
async function resolveDependencies(
  cell: Cell,
  cells: Record<string, Cell>,
  sheetId: string,
  registry: CellRegistry,
  sqlSelectToJson?: SqlSelectToJsonFn,
): Promise<string[]> {
  const item = registry[cell.type];
  if (!item) return [];

  if (item.findDependenciesAsync && sqlSelectToJson) {
    return item.findDependenciesAsync({cell, cells, sheetId, sqlSelectToJson});
  }
  return item.findDependencies({cell, cells, sheetId});
}

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

export function createCellsSlice(props: CellsSliceOptions) {
  const supportedSheetTypes = props.supportedSheetTypes ?? [
    'notebook',
    'canvas',
  ];

  return createSlice<CellsSliceState, CellsRootState>((set, get, store) => {
    return {
      cells: {
        cellRegistry: props.cellRegistry,
        supportedSheetTypes,
        config: {
          data: {},
          sheets: {},
          sheetOrder: [],
          currentSheetId: undefined,
        },
        status: {},
        activeAbortControllers: {},

        addCell: async (sheetId: string, cell: Cell, index?: number) => {
          // Pre-compute dependencies outside produce() to support async
          const sqlSelectToJson = (get() as any).db?.sqlSelectToJson as
            | SqlSelectToJsonFn
            | undefined;
          const deps = await resolveDependencies(
            cell,
            get().cells.config.data,
            sheetId,
            props.cellRegistry,
            sqlSelectToJson,
          );

          set((state) =>
            produce(state, (draft) => {
              draft.cells.config.data[cell.id] = cell as any;
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

              // Add edges from pre-computed dependencies
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

        updateCell: async (id: string, updater: (cell: Cell) => Cell) => {
          const cell = get().cells.config.data[id];
          if (!cell) return;

          const updatedCell = updater(cell);

          // Check if resultName changed for SQL cells with successful execution
          const resultNameChanged =
            cell.type === 'sql' &&
            updatedCell.type === 'sql' &&
            cell.data.resultName !== updatedCell.data.resultName;

          const existingStatus = get().cells.status[id];
          const hasExistingView =
            resultNameChanged &&
            existingStatus?.type === 'sql' &&
            existingStatus.status === 'success' &&
            existingStatus.resultView;

          // Pre-compute dependencies outside produce() to support async
          const sqlSelectToJson = (get() as any).db?.sqlSelectToJson as
            | SqlSelectToJsonFn
            | undefined;
          const newDeps = await resolveDependencies(
            updatedCell,
            get().cells.config.data,
            '', // sheetId not needed for dependency derivation
            props.cellRegistry,
            sqlSelectToJson,
          );

          set((state) =>
            produce(state, (draft) => {
              draft.cells.config.data[id] = updatedCell as any;

              // Update edges in all sheets this cell belongs to
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
            }),
          );

          // If we have an existing view, rename it instead of invalidating
          if (hasExistingView && existingStatus?.resultView) {
            const registryItem = props.cellRegistry[cell.type];
            if (registryItem?.renameResult) {
              void registryItem.renameResult({
                id,
                oldResultView: existingStatus.resultView,
                get,
                set,
              });
            }
          }

          // After update, trigger cascade
          for (const sheetId of get().cells.config.sheetOrder) {
            const sheet = get().cells.config.sheets[sheetId];
            if (sheet?.cellIds.includes(id)) {
              void get().cells.runDownstreamCascade(sheetId, id);
            }
          }
        },

        addSheet: (title?: string, type: SheetType = 'notebook') => {
          const id = createId();
          set((state) =>
            produce(state, (draft) => {
              const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
              const existingTitles = Object.values(
                draft.cells.config.sheets,
              ).map((s) => s.title);
              const defaultTitle = generateUniqueName(
                `${typeLabel} 1`,
                existingTitles,
                ' ',
              );

              draft.cells.config.sheets[id] = {
                id,
                type,
                title: title || defaultTitle,
                cellIds: [],
                edges: [],
              };
              draft.cells.config.sheetOrder.push(id);
              draft.cells.config.currentSheetId = id;
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

        closeSheet: (sheetId: string) => {
          set((state) =>
            produce(state, (draft) => {
              draft.cells.config.sheetOrder =
                draft.cells.config.sheetOrder.filter((id) => id !== sheetId);
              if (draft.cells.config.currentSheetId === sheetId) {
                draft.cells.config.currentSheetId =
                  draft.cells.config.sheetOrder[0];
              }
            }),
          );
        },

        openSheet: (sheetId: string) => {
          set((state) =>
            produce(state, (draft) => {
              if (!draft.cells.config.sheetOrder.includes(sheetId)) {
                draft.cells.config.sheetOrder.push(sheetId);
              }
              draft.cells.config.currentSheetId = sheetId;
            }),
          );
        },

        setSheetOrder: (sheetOrder: string[]) => {
          set((state) =>
            produce(state, (draft) => {
              draft.cells.config.sheetOrder = sheetOrder;
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

        updateEdgesFromSql: async (sheetId: string, cellId: string) => {
          const cell = get().cells.config.data[cellId];
          const sheet = get().cells.config.sheets[sheetId];
          if (!cell || !sheet) return;

          // Pre-compute dependencies outside produce() to support async
          const sqlSelectToJson = (get() as any).db?.sqlSelectToJson as
            | SqlSelectToJsonFn
            | undefined;
          const deps = await resolveDependencies(
            cell,
            get().cells.config.data,
            sheetId,
            props.cellRegistry,
            sqlSelectToJson,
          );

          set((state) =>
            produce(state, (draft) => {
              const draftSheet = draft.cells.config.sheets[sheetId];
              if (draftSheet) {
                draftSheet.edges = draftSheet.edges.filter(
                  (e) => e.target !== cellId,
                );
                for (const depId of deps) {
                  draftSheet.edges.push({
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
            // Pass get/set to registry's runCell
            await registryItem.runCell({id, opts, get, set});
            return;
          }

          // No default behavior - each cell type must define runCell if needed
        },
        cancelCell: (id: string) => {
          const state = get();
          const controller = state.cells.activeAbortControllers[id];
          if (controller) {
            controller.abort();
          }
        },
        invalidateCellStatus: (id: string) => {
          set((state) =>
            produce(state, (draft) => {
              const status = draft.cells.status[id];
              if (status?.type === 'sql') {
                // Reset to idle, clearing the result so user knows to re-run
                draft.cells.status[id] = {
                  type: 'sql',
                  status: 'idle',
                  referencedTables: status.referencedTables || [],
                };
              }
            }),
          );
        },

        // DAG methods (sync versions for UI usage)
        getRootCells: (sheetId: string) => {
          const {dependencies} = buildDependencyGraph(sheetId, get());
          const ids = Object.keys(dependencies);
          return ids.filter((id) => (dependencies[id]?.length ?? 0) === 0);
        },
        getDownstream: (sheetId: string, sourceCellId: string) => {
          const {dependencies, dependents} = buildDependencyGraph(
            sheetId,
            get(),
          );
          const reachable = collectReachable(sourceCellId, dependents);
          if (!reachable.size) return [];
          reachable.delete(sourceCellId);
          const rootsWithinScope = Array.from(reachable).filter((id) => {
            const deps = dependencies[id] || [];
            return deps.filter((d) => reachable.has(d)).length === 0;
          });
          return topologicalOrder(
            rootsWithinScope,
            dependencies,
            dependents,
            reachable,
          );
        },
        // Async cascade execution using AST-based dependency resolution
        runAllCellsCascade: async (sheetId: string) => {
          const sqlSelectToJson = (get() as any).db?.sqlSelectToJson as
            | SqlSelectToJsonFn
            | undefined;
          const {dependencies, dependents} = await buildDependencyGraphAsync(
            sheetId,
            get(),
            sqlSelectToJson,
          );
          const roots = Object.keys(dependencies).filter(
            (id) => (dependencies[id]?.length ?? 0) === 0,
          );
          const order = topologicalOrder(roots, dependencies, dependents);
          for (const cellId of order) {
            await get().cells.runCell(cellId, {cascade: false});
          }
        },
        runDownstreamCascade: async (sheetId: string, sourceCellId: string) => {
          const sqlSelectToJson = (get() as any).db?.sqlSelectToJson as
            | SqlSelectToJsonFn
            | undefined;
          const {dependencies, dependents} = await buildDependencyGraphAsync(
            sheetId,
            get(),
            sqlSelectToJson,
          );
          const reachable = collectReachable(sourceCellId, dependents);
          if (!reachable.size) return;
          reachable.delete(sourceCellId);
          const rootsWithinScope = Array.from(reachable).filter((id) => {
            const deps = dependencies[id] || [];
            return deps.filter((d) => reachable.has(d)).length === 0;
          });
          const order = topologicalOrder(
            rootsWithinScope,
            dependencies,
            dependents,
            reachable,
          );
          for (const cellId of order) {
            await get().cells.runCell(cellId, {cascade: false});
          }
        },
      },
    } as CellsSliceState;
  });
}
