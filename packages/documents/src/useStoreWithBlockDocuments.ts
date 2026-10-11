import {BaseRoomStoreState, useBaseRoomStore} from '@sqlrooms/room-store';
import type {BlockDocumentsSliceState} from './BlockDocumentsSlice';

type BlockDocumentsStoreState = BaseRoomStoreState & BlockDocumentsSliceState;

export function useStoreWithBlockDocuments<T>(
  selector: (state: BlockDocumentsStoreState) => T,
): T {
  return useBaseRoomStore<BlockDocumentsStoreState, T>(selector);
}
