import {BaseRoomStoreState, useBaseRoomStore} from '@sqlrooms/room-store';
import type {DocumentsSliceState} from './DocumentsSlice';

type DocumentsStoreState = BaseRoomStoreState & DocumentsSliceState;

export function useStoreWithDocuments<T>(
  selector: (state: DocumentsStoreState) => T,
): T {
  return useBaseRoomStore<DocumentsStoreState, T>(selector);
}
