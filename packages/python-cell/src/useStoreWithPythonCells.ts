import type {BaseRoomStoreState} from '@sqlrooms/room-store';
import {useBaseRoomStore} from '@sqlrooms/room-store';
import type {PythonCellSliceState} from './PythonCellSlice';

type PythonCellStoreState = BaseRoomStoreState & PythonCellSliceState;

/** Selects Python cell state from the active SQLRooms store. */
export function useStoreWithPythonCells<T>(
  selector: (state: PythonCellStoreState) => T,
): T {
  return useBaseRoomStore<PythonCellStoreState, T>(selector);
}
