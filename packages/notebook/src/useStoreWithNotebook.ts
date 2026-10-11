import type {CellsSliceState} from '@sqlrooms/cells';
import type {DbSliceState} from '@sqlrooms/db';
import {BaseRoomStoreState, useBaseRoomStore} from '@sqlrooms/room-store';

import type {NotebookSliceState} from './NotebookStateTypes';

type NotebookStoreState = BaseRoomStoreState &
  DbSliceState &
  NotebookSliceState &
  CellsSliceState;

/**
 * Select from the room store while asserting that the notebook slice is loaded.
 */
export function useStoreWithNotebook<T>(
  selector: (state: NotebookStoreState) => T,
): T {
  return useBaseRoomStore<NotebookStoreState, T>(selector);
}
