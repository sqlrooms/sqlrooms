import {type PivotHostBinding, type PivotPersistedState} from '@sqlrooms/pivot';
import {produce} from 'immer';
import type {StoreApi} from 'zustand';
import {getPivotQuerySourceForCell} from './pivotHelpers';
import {isPivotCell, type CellsRootState} from './types';

export function createNotebookPivotBinding(
  roomStore: StoreApi<CellsRootState>,
): PivotHostBinding<CellsRootState, string> {
  return {
    getPersistedState: (rootState, cellId) => {
      const cell = rootState.cells.config.data[cellId];
      if (!cell || !isPivotCell(cell)) {
        return undefined;
      }
      return {
        source: cell.data.source,
        config: cell.data.pivotConfig,
      };
    },
    setPersistedState: (cellId, updater) => {
      roomStore.getState().cells.updateCell(cellId, (current) =>
        produce(current, (draft) => {
          if (!isPivotCell(draft)) {
            return;
          }
          const nextPersisted = updater({
            source: draft.data.source,
            config: draft.data.pivotConfig,
          } satisfies PivotPersistedState);
          draft.data.source = nextPersisted.source;
          draft.data.pivotConfig = nextPersisted.config;
        }),
      );
    },
    getRuntimeState: (rootState, cellId) => {
      const cell = rootState.cells.config.data[cellId];
      const pivotCell = cell && isPivotCell(cell) ? cell : undefined;
      const runtime = pivotCell
        ? getPivotQuerySourceForCell(rootState, pivotCell)
        : {};
      const fields = runtime.querySource?.columns ?? [];
      const status = rootState.cells.status[cellId];

      return {
        status:
          status?.type === 'pivot'
            ? {
                state: status.status,
                stale: status.stale,
                lastError: status.lastError,
                lastRunTime: status.lastRunTime,
                relations: runtime.querySource ? status.resultViews : undefined,
                sourceRelation: runtime.sourceRelation,
              }
            : {state: 'idle', stale: false},
        querySource: runtime.querySource,
        fields,
        availableTables: rootState.db.tables.map((table) => table.tableName),
      };
    },
    run: (cellId) => roomStore.getState().cells.runCell(cellId),
    subscribe: (listener) => roomStore.subscribe(listener),
  };
}
