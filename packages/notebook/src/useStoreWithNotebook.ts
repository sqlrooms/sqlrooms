import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import {BaseRoomStoreState, useBaseRoomStore} from '@sqlrooms/room-shell';

import type {NotebookSliceState} from './NotebookSlice';

type NotebookStoreState = BaseRoomStoreState &
  DuckDbSliceState &
  NotebookSliceState;

/**
 * Select from the room store while asserting that the notebook slice is loaded.
 */
export function useStoreWithNotebook<T>(
  selector: (state: NotebookStoreState) => T,
): T {
  return useBaseRoomStore<NotebookStoreState, T>(selector);
}
