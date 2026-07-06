import {
  createBlockDocumentCommandAiAdapter,
  type BlockDocumentAiAdapter,
  type BlockDocumentMoveBlockAiAdapter,
} from '@sqlrooms/documents';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';

/** Creates the CLI block-document adapter for Worksheet artifacts. */
export function createCliBlockDocumentAiAdapter(
  store: StoreApi<RoomState>,
): BlockDocumentAiAdapter & BlockDocumentMoveBlockAiAdapter {
  return createBlockDocumentCommandAiAdapter({
    store,
    isBlockDocumentArtifact: (artifact) => artifact.type === 'worksheet',
  });
}
