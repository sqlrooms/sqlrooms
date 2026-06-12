import type {WorksheetAiAdapter} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';

/**
 * Creates a worksheet-specific adapter for the worksheet agent.
 * Worksheets are block documents, not dashboards.
 */
export function createWorksheetAiAdapter(
  _store: StoreApi<RoomState>,
): WorksheetAiAdapter<RoomState> {
  return {
    getTables: (state) => state.db.tables,

    setCurrentArtifact: (state, artifactId) =>
      state.artifacts.setCurrentArtifact(artifactId),

    getCurrentWorksheetId: (state) => {
      const currentId = state.artifacts.config.currentArtifactId;
      if (!currentId) return undefined;

      const artifact = state.artifacts.config.artifactsById[currentId];
      // Return current artifact only if it's a worksheet
      return artifact?.type === 'worksheet' ? currentId : undefined;
    },

    createWorksheet: (state, title) => {
      // Create a worksheet artifact
      const worksheetId = state.artifacts.createArtifact({
        type: 'worksheet',
        title: title || 'Worksheet',
      });

      // Initialize empty block document for this worksheet
      state.blockDocuments.ensureBlockDocument(worksheetId);

      return worksheetId;
    },

    isWorksheet: (state, artifactId) =>
      state.artifacts.getArtifact(artifactId)?.type === 'worksheet',

    ensureWorksheet: (state, worksheetId) => {
      state.blockDocuments.ensureBlockDocument(worksheetId);
    },

    getWorksheetBlocks: (state, worksheetId) => {
      const artifact = state.artifacts.getArtifact(worksheetId);
      if (!artifact || artifact.type !== 'worksheet') return undefined;

      const blockDoc = state.blockDocuments.config.artifacts[worksheetId];
      if (!blockDoc) return undefined;

      // Return blocks from the block document
      return blockDoc.content.content.map((node: any) => node.attrs);
    },
  };
}
