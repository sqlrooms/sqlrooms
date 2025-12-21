import {produce} from 'immer';
import {createSlice, type BaseRoomStoreState} from '@sqlrooms/room-shell';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import {type Cell, type CellsSliceState, type DagSliceState} from './types';
import {executeSqlCell} from './execution';

export type CellsRootState = BaseRoomStoreState &
  DuckDbSliceState &
  CellsSliceState &
  DagSliceState;

export function createCellsSlice() {
  return createSlice<CellsSliceState, CellsRootState>((set, get, _store) => ({
    cells: {
      data: {},
      status: {},
      activeAbortControllers: {},
      addCell: (cell: Cell) => {
        set((state) =>
          produce(state, (draft) => {
            draft.cells.data[cell.id] = cell;
            if (cell.type === 'sql') {
              draft.cells.status[cell.id] = {
                type: 'sql',
                status: 'idle',
                referencedTables: [],
              };
            } else {
              draft.cells.status[cell.id] = {type: 'other'};
            }
          }),
        );
      },
      removeCell: (id: string) => {
        set((state) =>
          produce(state, (draft) => {
            delete draft.cells.data[id];
            delete draft.cells.status[id];
            const controller = draft.cells.activeAbortControllers[id];
            if (controller) {
              controller.abort();
              delete draft.cells.activeAbortControllers[id];
            }
          }),
        );
      },
      updateCell: (id: string, updater: (cell: Cell) => Cell) => {
        set((state) =>
          produce(state, (draft) => {
            const cell = draft.cells.data[id];
            if (cell) {
              draft.cells.data[id] = updater(cell);
            }
          }),
        );
      },
      runCell: async (
        id: string,
        opts?: {cascade?: boolean; schemaName?: string},
      ) => {
        const state = get();
        const cell = state.cells.data[id];
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
  }));
}
