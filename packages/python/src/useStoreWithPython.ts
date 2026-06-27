import type {BaseRoomStoreState} from '@sqlrooms/room-store';
import {useBaseRoomStore} from '@sqlrooms/room-store';
import type {PythonSliceState} from './PythonSlice';

type PythonStoreState = BaseRoomStoreState & PythonSliceState;

/** Selects Python state from the active SQLRooms store. */
export function useStoreWithPython<T>(
  selector: (state: PythonStoreState) => T,
): T {
  return useBaseRoomStore<PythonStoreState, T>(selector);
}
