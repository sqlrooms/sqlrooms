import type {WorksheetAiAdapter} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';
import {
  BlockDocumentStatefulBlockBlock,
  createDefaultBlockDocumentBlockId,
} from '@sqlrooms/documents';

/**
 * Creates a worksheet-specific adapter for the worksheet agent.
 * Worksheets are block documents, not dashboards.
 */
export function createWorksheetAiAdapter(
  store: StoreApi<RoomState>,
): WorksheetAiAdapter {
  return {
    setCurrentWorksheet: (artifactId) =>
      store.getState().artifacts.setCurrentArtifact(artifactId),

    ensureWorksheet: (worksheetId) => {
      const state = store.getState();

      if (state.artifacts.getArtifact(worksheetId)?.type !== 'worksheet') {
        throw new Error(`Artifact ${worksheetId} is not a worksheet`);
      }

      state.blockDocuments.ensureBlockDocument(worksheetId);
    },

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

      // Return blocks from the block document
      return blockDocument.content.content;
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

    addDashboardBlock: (worksheetId, title, tableName) => {
      const state = store.getState();
      // Ensure the worksheet and its block document exist
      state.blockDocuments.ensureBlockDocument(worksheetId);

      const dashboardId = state.mosaicDashboard.createDashboard(title);

      state.mosaicDashboard.setSelectedTable(dashboardId, tableName);

      const block: BlockDocumentStatefulBlockBlock = {
        type: 'statefulBlock',
        id: createDefaultBlockDocumentBlockId(),
        blockInstanceId: dashboardId,
        blockType: 'dashboard',
        caption: title,
      };

      // Append the block to the worksheet
      state.blockDocuments.appendBlocks(worksheetId, [block]);

      // Return the block ID
      return {
        blockId: block.id,
        dashboardId,
      };
    },

    addDataTableExplorerBlock: (worksheetId, title, tableName) => {
      const state = store.getState();
      // Ensure the worksheet and its block document exist
      state.blockDocuments.ensureBlockDocument(worksheetId);

      const block: BlockDocumentStatefulBlockBlock = {
        type: 'statefulBlock',
        id: createDefaultBlockDocumentBlockId(),
        blockInstanceId: createDefaultBlockDocumentBlockId(),
        blockType: 'data-table',
        title: tableName,
        caption: title,
      };

      // Append the block to the worksheet
      state.blockDocuments.appendBlocks(worksheetId, [block]);

      // Return the block ID
      return block.id;
    },
  };
}
