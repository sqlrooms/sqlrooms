import {useBaseRoomStore} from '@sqlrooms/room-store';
import type {CellsSliceState} from './types';

export type CellsStoreState = {
  cells: CellsSliceState['cells'];
};

/**
 * Hook to access the cells slice from the room store.
 * This works in any app that includes createCellsSlice in its store.
 */
export function useCellsStore<T>(selector: (state: CellsStoreState) => T): T {
  return useBaseRoomStore<CellsStoreState, T>(selector);
}
