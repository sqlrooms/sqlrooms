import type {BlockDocumentAiAdapter} from '@sqlrooms/documents';
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
): BlockDocumentAiAdapter {
  const ensureBlockDocument = (blockDocumentId: string) => {
    const state = store.getState();

    if (state.artifacts.getArtifact(blockDocumentId)?.type !== 'worksheet') {
      throw new Error(`Artifact ${blockDocumentId} is not a worksheet`);
    }

    state.blockDocuments.ensureBlockDocument(blockDocumentId);
  };

  return {
    setCurrentBlockDocument: (artifactId) =>
      store.getState().artifacts.setCurrentArtifact(artifactId),

    ensureBlockDocument,

    getBlocks: (blockDocumentId) => {
      const state = store.getState();
      const artifact = state.artifacts.getArtifact(blockDocumentId);
      if (!artifact || artifact.type !== 'worksheet') {
        return undefined;
      }

      const blockDocument =
        state.blockDocuments.config.artifacts[blockDocumentId];
      if (!blockDocument) {
        return undefined;
      }

      return blockDocument.content.content;
    },

    addBlock: (blockDocumentId, block) => {
      ensureBlockDocument(blockDocumentId);

      const state = store.getState();
      state.blockDocuments.appendBlocks(blockDocumentId, [block]);

      return block.id;
    },
  };
}

/**
 * Helper to create Mosaic dashboard blocks for use with createAddMosaicDashboardBlockTool.
 */
export function createDashboardBlockForWorksheet(
  store: StoreApi<RoomState>,
  params: {
    title: string;
    tableName: string;
    intent?: string;
  },
): {dashboardId: string; block: BlockDocumentStatefulBlockBlock} {
  const state = store.getState();
  const dashboardId = state.mosaicDashboard.createDashboard(params.title);

  state.mosaicDashboard.setSelectedTable(dashboardId, params.tableName);

  const block: BlockDocumentStatefulBlockBlock = {
    type: 'statefulBlock',
    id: createDefaultBlockDocumentBlockId(),
    blockInstanceId: dashboardId,
    blockType: 'dashboard',
    intent: params.intent,
    caption: params.title,
  };

  return {
    blockId: block.id,
    dashboardId,
  } as {dashboardId: string; block: BlockDocumentStatefulBlockBlock};
}
