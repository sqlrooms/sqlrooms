import type {BlockDocumentAiAdapter} from '@sqlrooms/documents';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';

/**
 * Creates a worksheet-specific adapter for the worksheet agent.
 * Worksheets are block documents, not dashboards.
 */
export function createWorksheetAiAdapter(
  store: StoreApi<RoomState>,
): BlockDocumentAiAdapter {
  const ensureWorksheet = (worksheetId: string) => {
    const state = store.getState();

    if (state.artifacts.getArtifact(worksheetId)?.type !== 'worksheet') {
      throw new Error(`Artifact ${worksheetId} is not a worksheet`);
    }

    state.blockDocuments.ensureBlockDocument(worksheetId);
  };

  return {
    setCurrentBlockDocument: (artifactId) =>
      store.getState().artifacts.setCurrentArtifact(artifactId),

    ensureBlockDocument: ensureWorksheet,

    getBlocks: (worksheetId) => {
      const state = store.getState();
      const artifact = state.artifacts.getArtifact(worksheetId);
      if (!artifact || artifact.type !== 'worksheet') {
        return undefined;
      }

      const blockDocument = state.blockDocuments.config.artifacts[worksheetId];
      if (!blockDocument) {
        return undefined;
      }

      return blockDocument.content.content;
    },

    addBlock: (worksheetId, block) => {
      ensureWorksheet(worksheetId);

      const state = store.getState();
      state.blockDocuments.appendBlocks(worksheetId, [block]);

      return block.id;
    },
  };
}
