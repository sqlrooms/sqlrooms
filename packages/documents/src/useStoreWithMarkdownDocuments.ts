import {BaseRoomStoreState, useBaseRoomStore} from '@sqlrooms/room-store';
import type {MarkdownDocumentsSliceState} from './MarkdownDocumentsSlice';

type MarkdownDocumentsStoreState = BaseRoomStoreState &
  MarkdownDocumentsSliceState;

/** Selects state from a room with the Markdown documents slice installed. */
export function useStoreWithMarkdownDocuments<T>(
  selector: (state: MarkdownDocumentsStoreState) => T,
): T {
  return useBaseRoomStore<MarkdownDocumentsStoreState, T>(selector);
}
