import {createId} from '@paralleldrive/cuid2';
import {makePagedQuery} from '@sqlrooms/data-table';
import {sanitizeQuery} from '@sqlrooms/duckdb';
import {createSlice} from '@sqlrooms/room-store';
import {generateUniqueName} from '@sqlrooms/utils';
import {produce} from 'immer';
import {
  buildDependencyGraph,
  buildDependencyGraphAsync,
  collectReachable,
  topologicalOrder,
} from './dagUtils';
import {createDefaultCellRegistry} from './defaultCellRegistry';
import {getSqlSelectToJson, resolveDependencies} from './helpers';
import type {
  Cell,
  CellResultData,
  CellsRootState,
  CellsSliceConfig,
  CellsSliceOptions,
  CellsSliceState,
  Edge,
  SheetType,
} from './types';
import {isInputCell, isSqlCell} from './types';
import {getSheetSchemaName} from './utils';

export type {CellsRootState} from './types';

/** Module-level cache for Arrow result data (outside Immer to avoid freezing) */
const cellResultCache = new Map<string, CellResultData>();

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function createDefaultCellsConfig(
  config: Partial<CellsSliceConfig> | undefined,
): CellsSliceConfig {
  const sheetId = createId();
  return {
    data: {},
    sheets: {
      [sheetId]: {
        id: sheetId,
        type: 'notebook',
        title: 'Sheet',
        schemaName: getSheetSchemaName(sheetId),
        cellIds: [],
        edges: [],
      },
    },
    sheetOrder: [sheetId],
    currentSheetId: sheetId,
    ...config,
  };
}

// --- Slice Implementation ---

export function createCellsSlice(props?: CellsSliceOptions) {
  const {
    cellRegistry = createDefaultCellRegistry(),
    supportedSheetTypes = ['notebook', 'canvas'],
  } = props ?? {};
  const initialConfig = createDefaultCellsConfig(props?.config);
  return createSlice<CellsSliceState, CellsRootState>((set, get, store) => {
    return {
      cells: {
        cellRegistry,
        supportedSheetTypes,
        config: initialConfig,
        status: {},
        activeAbortControllers: {},
        resultVersion: {},
        pageVersion: {},

        addCell: async (sheetId: string, cell: Cell, index?: number) => {
          // Pre-compute dependencies outside produce() to support async
          const sqlSelectToJson = getSqlSelectToJson(get());
          const targetSheet = get().cells.config.sheets[sheetId];
          const scopedCells = Object.fromEntries(
            (targetSheet?.cellIds ?? [])
              .map((id) => get().cells.config.data[id])
              .filter(isDefined)
              .map((candidate) => [candidate.id, candidate]),
          ) as Record<string, Cell>;
          scopedCells[cell.id] = cell;
          const deps = await resolveDependencies(
            cell,
            scopedCells,
            sheetId,
            cellRegistry,
            sqlSelectToJson,
          );

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

              // Single-owner invariant: a cell can belong to one sheet only.
              for (const [existingSheetId, existingSheet] of Object.entries(
                draft.cells.config.sheets,
              )) {
                if (existingSheetId === sheetId) continue;
                existingSheet.cellIds = existingSheet.cellIds.filter(
                  (cid) => cid !== cell.id,
                );
                existingSheet.edges = existingSheet.edges.filter(
                  (e) => e.source !== cell.id && e.target !== cell.id,
                );
              }

              let sheet = draft.cells.config.sheets[sheetId];
              if (!sheet) {
                sheet = {
                  id: sheetId,
                  type: 'notebook',
                  title: 'Sheet',
                  schemaName: getSheetSchemaName(sheetId),
                  cellIds: [],
                  edges: [],
                };
                draft.cells.config.sheets[sheetId] = sheet;
                if (!draft.cells.config.sheetOrder.includes(sheetId)) {
                  draft.cells.config.sheetOrder.push(sheetId);
                }
                if (!draft.cells.config.currentSheetId) {
                  draft.cells.config.currentSheetId = sheetId;
                }
              }

              const newIndex =
                index !== undefined ? index : sheet.cellIds.length;
              sheet.cellIds = sheet.cellIds.filter((cid) => cid !== cell.id);
              sheet.cellIds.splice(newIndex, 0, cell.id);

              // Add edges from pre-computed dependencies
              const localCellIds = new Set(sheet.cellIds);
              for (const depId of deps) {
                if (!localCellIds.has(depId) || depId === cell.id) continue;
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
          cellResultCache.delete(id);
          set((state) =>
            produce(state, (draft) => {
              delete draft.cells.config.data[id];
              delete draft.cells.status[id];
              delete draft.cells.resultVersion[id];
              delete draft.cells.pageVersion[id];
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

        updateCell: async (
          id: string,
          updater: (cell: Cell) => Cell,
          opts?: {cascade?: boolean},
        ) => {
          const cell = get().cells.config.data[id];
          if (!cell) return;
          const ownerSheetId = Object.entries(get().cells.config.sheets).find(
            ([, sheet]) => sheet.cellIds.includes(id),
          )?.[0];
          const scopedCells = Object.fromEntries(
            (
              (ownerSheetId &&
                get().cells.config.sheets[ownerSheetId]?.cellIds) ||
              []
            )
              .map((cellId) => get().cells.config.data[cellId])
              .filter(isDefined)
              .map((candidate) => [candidate.id, candidate]),
          ) as Record<string, Cell>;

          const updatedCell = updater(cell);
          scopedCells[id] = updatedCell;

          // Check if resultName changed for SQL cells with successful execution
          const resultNameChanged =
            isSqlCell(cell) &&
            isSqlCell(updatedCell) &&
            cell.data.resultName !== updatedCell.data.resultName;

          const existingStatus = get().cells.status[id];
          const hasExistingView =
            resultNameChanged &&
            existingStatus?.type === 'sql' &&
            existingStatus.status === 'success' &&
            existingStatus.resultView;

          const semanticInputChanged =
            isInputCell(cell) &&
            isInputCell(updatedCell) &&
            (cell.data.input.varName !== updatedCell.data.input.varName ||
              cell.data.input.value !== updatedCell.data.input.value);
          const semanticSqlChanged =
            isSqlCell(cell) &&
            isSqlCell(updatedCell) &&
            cell.data.sql !== updatedCell.data.sql;

          // Apply cell data to the store immediately so that other
          // actions (e.g. runCell triggered via Cmd+Enter) always see
          // the latest value. Edge/dependency updates follow
          // asynchronously below.
          set((state) =>
            produce(state, (draft) => {
              draft.cells.config.data[id] = updatedCell;
            }),
          );

          // Pre-compute dependencies outside produce() to support async
          const sqlSelectToJson = getSqlSelectToJson(get());
          const newDeps = await resolveDependencies(
            updatedCell,
            scopedCells,
            ownerSheetId || '',
            cellRegistry,
            sqlSelectToJson,
          );

          set((state) =>
            produce(state, (draft) => {
              const ownerSheet = Object.values(draft.cells.config.sheets).find(
                (sheet) => sheet.cellIds.includes(id),
              );
              if (ownerSheet) {
                const localCellIds = new Set(ownerSheet.cellIds);
                ownerSheet.edges = ownerSheet.edges.filter(
                  (e) => e.target !== id,
                );
                for (const depId of newDeps) {
                  if (!localCellIds.has(depId) || depId === id) continue;
                  ownerSheet.edges.push({
                    id: `${depId}-${id}`,
                    source: depId,
                    target: id,
                  });
                }
              }
            }),
          );

          // If we have an existing view, rename it instead of invalidating
          if (hasExistingView && existingStatus?.resultView) {
            const registryItem = cellRegistry[cell.type];
            if (registryItem?.renameResult) {
              void registryItem.renameResult({
                id,
                oldResultView: existingStatus.resultView,
                get,
                set,
              });
            }
          }

          // After update, trigger cascade only if explicitly requested
          // or if semantic execution inputs changed.
          const shouldCascade =
            opts?.cascade ||
            resultNameChanged ||
            semanticSqlChanged ||
            semanticInputChanged;
          if (shouldCascade) {
            if (ownerSheetId) {
              void get().cells.runDownstreamCascade(ownerSheetId, id);
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
                schemaName: getSheetSchemaName(id),
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
          const sheet = get().cells.config.sheets[sheetId];
          if (!sheet) return;
          const ownedCellIds = [...sheet.cellIds];
          set((state) =>
            produce(state, (draft) => {
              for (const cellId of ownedCellIds) {
                cellResultCache.delete(cellId);
                delete draft.cells.config.data[cellId];
                delete draft.cells.status[cellId];
                delete draft.cells.resultVersion[cellId];
                delete draft.cells.pageVersion[cellId];
                const controller = draft.cells.activeAbortControllers[cellId];
                if (controller) {
                  controller.abort();
                }
                delete draft.cells.activeAbortControllers[cellId];
              }

              for (const existingSheet of Object.values(
                draft.cells.config.sheets,
              )) {
                existingSheet.cellIds = existingSheet.cellIds.filter(
                  (cid) => !ownedCellIds.includes(cid),
                );
                existingSheet.edges = existingSheet.edges.filter(
                  (e) =>
                    !ownedCellIds.includes(e.source) &&
                    !ownedCellIds.includes(e.target),
                );
              }

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
                  schemaName: getSheetSchemaName(sheetId),
                  cellIds: [],
                  edges: [],
                };
                draft.cells.config.sheets[sheetId] = sheet;
                if (!draft.cells.config.sheetOrder.includes(sheetId)) {
                  draft.cells.config.sheetOrder.push(sheetId);
                }
                if (!draft.cells.config.currentSheetId) {
                  draft.cells.config.currentSheetId = sheetId;
                }
              }
              if (
                !sheet.cellIds.includes(edge.source) ||
                !sheet.cellIds.includes(edge.target)
              ) {
                return;
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
          const sqlSelectToJson = getSqlSelectToJson(get());
          const scopedCells = Object.fromEntries(
            sheet.cellIds
              .map((id) => get().cells.config.data[id])
              .filter(isDefined)
              .map((candidate) => [candidate.id, candidate]),
          ) as Record<string, Cell>;
          const deps = await resolveDependencies(
            cell,
            scopedCells,
            sheetId,
            cellRegistry,
            sqlSelectToJson,
          );

          set((state) =>
            produce(state, (draft) => {
              const draftSheet = draft.cells.config.sheets[sheetId];
              if (draftSheet) {
                draftSheet.edges = draftSheet.edges.filter(
                  (e) => e.target !== cellId,
                );
                const localCellIds = new Set(draftSheet.cellIds);
                for (const depId of deps) {
                  if (!localCellIds.has(depId) || depId === cellId) continue;
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

          const registryItem = cellRegistry[cell.type];
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

        // Cell result cache actions
        setCellResult: (id: string, data: CellResultData) => {
          cellResultCache.set(id, data);
          set((state) =>
            produce(state, (draft) => {
              draft.cells.resultVersion[id] =
                (draft.cells.resultVersion[id] ?? 0) + 1;
            }),
          );
        },

        setCellResultPage: (id: string, data: CellResultData) => {
          cellResultCache.set(id, data);
          set((state) =>
            produce(state, (draft) => {
              draft.cells.pageVersion[id] =
                (draft.cells.pageVersion[id] ?? 0) + 1;
            }),
          );
        },

        getCellResult: (id: string) => {
          return cellResultCache.get(id);
        },

        clearCellResult: (id: string) => {
          cellResultCache.delete(id);
          set((state) =>
            produce(state, (draft) => {
              delete draft.cells.resultVersion[id];
              delete draft.cells.pageVersion[id];
            }),
          );
        },

        fetchCellResultPage: async (
          id: string,
          pagination: {pageIndex: number; pageSize: number},
          sorting?: {id: string; desc: boolean}[],
        ) => {
          const state = get();
          const status = state.cells.status[id];
          if (status?.type !== 'sql' || !status.resultView) return;

          const connector = await state.db.getConnector();
          const baseQuery = sanitizeQuery(`SELECT * FROM ${status.resultView}`);
          const pagedQuery = makePagedQuery(
            baseQuery,
            sorting ?? [],
            pagination,
          );

          const arrowTable = await connector.query(pagedQuery);
          const countResult = await connector.query(
            `SELECT COUNT(*)::int AS count FROM ${status.resultView}`,
          );
          const totalRows = countResult.toArray()[0]?.count ?? 0;

          get().cells.setCellResultPage(id, {arrowTable, totalRows});
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
          const sqlSelectToJson = getSqlSelectToJson(get());
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
          const sqlSelectToJson = getSqlSelectToJson(get());
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
