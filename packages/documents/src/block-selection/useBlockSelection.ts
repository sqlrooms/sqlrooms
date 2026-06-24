import {useBaseRoomStore} from '@sqlrooms/room-store';
import type {BlockSelectionSliceState} from './BlockSelectionSlice';

export function useBlockSelection<T>(
  selector: (state: BlockSelectionSliceState) => T,
): T {
  return useBaseRoomStore<BlockSelectionSliceState, T>((state) =>
    selector(state),
  );
}
