import type {WorksheetAiAdapter} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';

/**
 * Creates a worksheet-specific adapter for the worksheet agent.
 * Worksheets are block documents, not dashboards.
 */
export function createWorksheetAiAdapter(
  store: StoreApi<RoomState>,
): WorksheetAiAdapter {
  return {
    getTables: () => store.getState().db.tables,

    setCurrentArtifact: (artifactId) =>
      store.getState().artifacts.setCurrentArtifact(artifactId),

    getCurrentWorksheetId: () => {
      const state = store.getState();
      const currentId = state.artifacts.config.currentArtifactId;
      if (!currentId) return undefined;

      const artifact = state.artifacts.config.artifactsById[currentId];
      // Return current artifact only if it's a worksheet
      return artifact?.type === 'worksheet' ? currentId : undefined;
    },

    createWorksheet: (title) => {
      const state = store.getState();
      // Create a worksheet artifact
      const worksheetId = state.artifacts.createArtifact({
        type: 'worksheet',
        title: title || 'Worksheet',
      });

      // Initialize empty block document for this worksheet
      state.blockDocuments.ensureBlockDocument(worksheetId);

      return worksheetId;
    },

    isWorksheet: (artifactId) =>
      store.getState().artifacts.getArtifact(artifactId)?.type === 'worksheet',

    ensureWorksheet: (worksheetId) => {
      store.getState().blockDocuments.ensureBlockDocument(worksheetId);
    },

    getWorksheetBlocks: (worksheetId) => {
      const state = store.getState();
      const artifact = state.artifacts.getArtifact(worksheetId);
      if (!artifact || artifact.type !== 'worksheet') {
        return undefined;
      }

      const blockDocument = state.blockDocuments.config.artifacts[worksheetId];
      if (!blockDocument) {
        return undefined;
      }

      // Return blocks from the block document
      return blockDocument.content.content.map((node: any) => node.attrs);
    },

    addBlock: (worksheetId, block) => {
      const state = store.getState();
      // Ensure the worksheet and its block document exist
      state.blockDocuments.ensureBlockDocument(worksheetId);

      // Append the block to the worksheet
      state.blockDocuments.appendBlocks(worksheetId, [block]);

      // Return the block ID
      return block.id;
    },
  };
}
