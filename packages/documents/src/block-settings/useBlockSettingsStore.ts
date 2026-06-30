import {useBaseRoomStore} from '@sqlrooms/room-store';
import type {BlockSettingsSliceState} from './BlockSettingsSlice';

export function useBlockSettingsStore<T>(
  selector: (state: BlockSettingsSliceState) => T,
): T {
  return useBaseRoomStore<BlockSettingsSliceState, T>((state) =>
    selector(state),
  );
}
