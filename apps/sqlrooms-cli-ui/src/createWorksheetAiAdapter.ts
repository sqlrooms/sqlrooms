import {
  createBlockDocumentCommandAiAdapter,
  type BlockDocumentAiAdapter,
  type BlockDocumentMoveBlockAiAdapter,
} from '@sqlrooms/documents';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';

/**
 * Creates a worksheet-specific adapter for the worksheet agent.
 * Worksheets are block documents, not dashboards.
 */
export function createWorksheetAiAdapter(
  store: StoreApi<RoomState>,
): BlockDocumentAiAdapter & BlockDocumentMoveBlockAiAdapter {
  return createBlockDocumentCommandAiAdapter({
    store,
    isBlockDocumentArtifact: (artifact) => artifact.type === 'worksheet',
  });
}
