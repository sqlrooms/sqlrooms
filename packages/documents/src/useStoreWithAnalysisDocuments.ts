import {BaseRoomStoreState, useBaseRoomStore} from '@sqlrooms/room-store';
import type {AnalysisDocumentsSliceState} from './AnalysisDocumentsSlice';

type AnalysisDocumentsStoreState = BaseRoomStoreState &
  AnalysisDocumentsSliceState;

export function useStoreWithAnalysisDocuments<T>(
  selector: (state: AnalysisDocumentsStoreState) => T,
): T {
  return useBaseRoomStore<AnalysisDocumentsStoreState, T>(selector);
}
