import {produce} from 'immer';
import {createSlice, type BaseRoomStoreState} from '@sqlrooms/room-shell';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import {
  type Cell,
  type CellsSliceState,
  type DagSliceState,
  type Sheet,
  type Edge,
} from './types';
import {executeSqlCell} from './execution';
import {createDagSlice} from './dagSlice';
import {createId} from '@paralleldrive/cuid2';
import {deriveEdgesFromSql} from './sqlHelpers';

export type CellsRootState = BaseRoomStoreState &
  DuckDbSliceState &
  CellsSliceState &
  DagSliceState;

export function createCellsSlice() {
  return createSlice<CellsSliceState & DagSliceState, CellsRootState>(
    (set, get, store) => {
      const dagSlice = createDagSlice<CellsRootState, Cell, {edges: Edge[]}>({
        getDagConfig: (state) => ({
          dags: Object.fromEntries(
            Object.entries(state.cells.config.sheets).map(([id, sheet]) => [
              id,
              {
                id,
                cells: Object.fromEntries(
                  sheet.cellIds
                    .map((cid) => state.cells.config.data[cid])
                    .filter((c): c is Cell => Boolean(c))
                    .map((c) => [c.id, c]),
                ),
                meta: {edges: sheet.edges},
              },
            ]),
          ),
          dagOrder: state.cells.config.sheetOrder,
          currentDagId: state.cells.config.currentSheetId,
        }),
        findDependencies: ({cell, dagId, getState}) => {
          const sheet = getState().cells.config.sheets[dagId];
          return (
            sheet?.edges
              .filter((e) => e.target === cell.id)
              .map((e) => e.source) ?? []
          );
        },
        runCell: async ({cellId, cascade, getState}) => {
          await getState().cells.runCell(cellId, {cascade});
        },
      })(set as any, get as any, store);

      return {
        ...dagSlice,
        cells: {
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

                // If it's a SQL cell, auto-derive edges
                if (cell.type === 'sql') {
                  const newEdges = deriveEdgesFromSql(
                    cell.id,
                    cell.data.sql,
                    draft.cells.config.data as Record<string, Cell>,
                  );
                  sheet.edges.push(...newEdges);
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

                  // If SQL changed, update edges in all sheets this cell belongs to
                  if (
                    updatedCell.type === 'sql' &&
                    (cell.type !== 'sql' ||
                      cell.data.sql !== updatedCell.data.sql)
                  ) {
                    const newEdges = deriveEdgesFromSql(
                      id,
                      updatedCell.data.sql,
                      draft.cells.config.data as Record<string, Cell>,
                    );
                    for (const sheet of Object.values(
                      draft.cells.config.sheets,
                    )) {
                      if (sheet.cellIds.includes(id)) {
                        // Remove old edges for this target
                        sheet.edges = sheet.edges.filter(
                          (e) => e.target !== id,
                        );
                        // Add new ones
                        sheet.edges.push(...newEdges);
                      }
                    }
                  }
                }
              }),
            );
            // After update, if it was a data change, we might want to trigger cascade
            const cell = get().cells.config.data[id];
            if (cell) {
              // We need to find which sheet(s) this cell belongs to and trigger cascade
              // For simplicity, trigger in all sheets it's in
              for (const sheetId of get().cells.config.sheetOrder) {
                const sheet = get().cells.config.sheets[sheetId];
                if (sheet?.cellIds.includes(id)) {
                  void get().dag.runDownstreamCascade(sheetId, id);
                }
              }
            }
          },

          addSheet: (title?: string) => {
            const id = createId();
            set((state) =>
              produce(state, (draft) => {
                draft.cells.config.sheets[id] = {
                  id,
                  title:
                    title ||
                    `Sheet ${draft.cells.config.sheetOrder.length + 1}`,
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
                let sheet = draft.cells.config.sheets[sheetId];
                if (!sheet) {
                  sheet = {
                    id: sheetId,
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
                const cell = draft.cells.config.data[cellId];
                if (cell && cell.type === 'sql') {
                  const newEdges = deriveEdgesFromSql(
                    cellId,
                    cell.data.sql,
                    draft.cells.config.data as Record<string, Cell>,
                  );
                  sheet.edges = sheet.edges.filter((e) => e.target !== cellId);
                  sheet.edges.push(...newEdges);
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
            if (!cell || cell.type !== 'sql') return;

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
    },
  );
}
