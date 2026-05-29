import {BaseRoomStoreState, useBaseRoomStore} from '@sqlrooms/room-store';
import type {BlocksDocumentsSliceState} from './BlocksDocumentsSlice';

type BlocksDocumentsStoreState = BaseRoomStoreState &
  BlocksDocumentsSliceState;

export function useStoreWithBlocksDocuments<T>(
  selector: (state: BlocksDocumentsStoreState) => T,
): T {
  return useBaseRoomStore<BlocksDocumentsStoreState, T>(selector);
}
