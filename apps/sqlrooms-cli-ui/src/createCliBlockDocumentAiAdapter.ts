import {
  createBlockDocumentCommandAiAdapter,
  type BlockDocumentBlockType,
  type BlockDocumentAiAdapter,
  type BlockDocumentMoveBlockAiAdapter,
} from '@sqlrooms/documents';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';

/** Creates the CLI block-document adapter for Worksheet artifacts. */
export function createCliBlockDocumentAiAdapter(
  store: StoreApi<RoomState>,
): BlockDocumentAiAdapter & BlockDocumentMoveBlockAiAdapter {
  const adapter = createBlockDocumentCommandAiAdapter({
    store,
    isBlockDocumentArtifact: (artifact) => artifact.type === 'worksheet',
  });

  return {
    ...adapter,
    updateBlock: async (
      blockDocumentId: string,
      blockId: string,
      block: BlockDocumentBlockType,
    ) => {
      adapter.ensureBlockDocument(blockDocumentId);

      const result = await store.getState().commands.invokeCommand(
        'block-document.update-block',
        {
          artifactId: blockDocumentId,
          blockId,
          block,
        },
        {
          surface: 'ai',
          actor: 'block-document-agent',
        },
      );

      if (!result.success) {
        throw new Error(
          result.error ??
            result.message ??
            'Failed to update block document block.',
        );
      }
    },
  };
}
