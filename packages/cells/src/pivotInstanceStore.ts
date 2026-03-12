import {
  createDefaultPivotConfig,
  createPivotInstanceAdapterStore,
  normalizePivotConfig,
  type PivotConfig,
  type PivotInstanceSnapshot,
  type PivotInstanceStore,
  type PivotSource,
} from '@sqlrooms/pivot';
import {produce} from 'immer';
import type {StoreApi} from 'zustand';
import {getPivotQuerySourceForCell} from './pivotHelpers';
import {isPivotCell, type CellsRootState} from './types';

export function createPivotCellStore(
  roomStore: StoreApi<CellsRootState>,
  cellId: string,
): PivotInstanceStore {
  const getSnapshot = (): PivotInstanceSnapshot => {
    const state = roomStore.getState();
    const cell = state.cells.config.data[cellId];
    const pivotCell = cell && isPivotCell(cell) ? cell : undefined;
    const runtime = pivotCell
      ? getPivotQuerySourceForCell(state, pivotCell)
      : {};
    const fields = runtime.querySource?.columns ?? [];
    const status = state.cells.status[cellId];

    return {
      source: pivotCell?.data.source,
      config: pivotCell
        ? normalizePivotConfig(pivotCell.data.pivotConfig, fields)
        : createDefaultPivotConfig(),
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
      availableTables: state.db.tables.map((table) => table.tableName),
    };
  };

  const setCellSource = (source: PivotSource | undefined) => {
    roomStore.getState().cells.updateCell(cellId, (current) =>
      produce(current, (draft) => {
        if (draft.type === 'pivot') {
          draft.data.source = source;
          draft.data.pivotConfig = createDefaultPivotConfig();
        }
      }),
    );
  };

  const setCellConfig = (config: PivotConfig) => {
    roomStore.getState().cells.updateCell(cellId, (current) =>
      produce(current, (draft) => {
        if (draft.type === 'pivot') {
          draft.data.pivotConfig = config;
        }
      }),
    );
  };

  return createPivotInstanceAdapterStore({
    getSnapshot,
    subscribeToHost: (listener: () => void) => roomStore.subscribe(listener),
    callbacks: {
      setSource: setCellSource,
      setConfig: setCellConfig,
      run: () => roomStore.getState().cells.runCell(cellId),
    },
  });
}
