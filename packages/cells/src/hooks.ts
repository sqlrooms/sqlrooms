import {useBaseRoomStore} from '@sqlrooms/room-shell';
import type {CellsSliceState, DagSliceState} from './types';

export type CellsStoreState = {
  cells: CellsSliceState['cells'];
  dag: DagSliceState['dag'];
};

/**
 * Hook to access the cells slice from the room store.
 * This works in any app that includes createCellsSlice in its store.
 */
export function useCellsStore<T>(selector: (state: CellsStoreState) => T): T {
  return useBaseRoomStore<CellsStoreState, T>(selector);
}
