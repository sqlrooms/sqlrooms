import type {ArtifactMetadataType} from '@sqlrooms/artifacts';
import type {CommandSliceState} from '@sqlrooms/room-store';
import type {StoreApi} from 'zustand';
import type {
  BlockDocumentAiAdapter,
  BlockDocumentMoveBlockAiAdapter,
} from './BlockDocumentAi';
import type {BlockDocumentBlock} from './BlockDocumentSliceConfig';
import type {BlockDocumentsSliceState} from './BlockDocumentsSlice';

export const BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID =
  'block-document.append-blocks';
export const BLOCK_DOCUMENT_UPDATE_BLOCK_COMMAND_ID =
  'block-document.update-block';
export const BLOCK_DOCUMENT_MOVE_BLOCK_COMMAND_ID = 'block-document.move-block';

export const BLOCK_DOCUMENT_AGENT_ACTOR = 'block-document-agent';

type BlockDocumentCommandAiAdapterState = BlockDocumentsSliceState &
  CommandSliceState<any> & {
    artifacts: {
      setCurrentArtifact: (id?: string) => void;
      getArtifact: (id: string) => ArtifactMetadataType | undefined;
    };
  };

export type CreateBlockDocumentCommandAiAdapterOptions<
  TRoomState extends BlockDocumentCommandAiAdapterState,
> = {
  /** Store with artifacts, block documents, and command slices mounted. */
  store: StoreApi<TRoomState>;
  /**
   * Optional host predicate for persisted artifact compatibility.
   *
   * Omit this for plain block-document artifacts. Hosts that temporarily persist
   * another artifact type can provide a predicate without leaking that type into
   * the reusable adapter API.
   */
  isBlockDocumentArtifact?: (artifact: ArtifactMetadataType) => boolean;
};

function blockIdFromAppendResult(data: unknown, block: BlockDocumentBlock) {
  const value = data as
    | {
        blockId?: string;
        blockIds?: string[];
      }
    | undefined;
  return value?.blockId ?? value?.blockIds?.[0] ?? block.id;
}

/**
 * Creates a block-document AI adapter that mutates blocks through canonical
 * block-document commands.
 */
export function createBlockDocumentCommandAiAdapter<
  TRoomState extends BlockDocumentCommandAiAdapterState,
>({
  store,
  isBlockDocumentArtifact = (artifact) => artifact.type === 'block-document',
}: CreateBlockDocumentCommandAiAdapterOptions<TRoomState>): BlockDocumentAiAdapter &
  BlockDocumentMoveBlockAiAdapter {
  const ensureBlockDocument = (artifactId: string) => {
    const state = store.getState();
    const artifact = state.artifacts.getArtifact(artifactId);

    if (!artifact || !isBlockDocumentArtifact(artifact)) {
      throw new Error(`Artifact ${artifactId} is not a block document`);
    }

    state.blockDocuments.ensureBlockDocument(artifactId);
  };

  return {
    setCurrentBlockDocument: (artifactId) =>
      store.getState().artifacts.setCurrentArtifact(artifactId),

    ensureBlockDocument,

    getBlocks: (artifactId) => {
      const state = store.getState();
      const artifact = state.artifacts.getArtifact(artifactId);
      if (!artifact || !isBlockDocumentArtifact(artifact)) {
        return undefined;
      }

      const blockDocument = state.blockDocuments.config.artifacts[artifactId];
      return blockDocument?.content.content;
    },

    addBlock: async (artifactId, block) => {
      ensureBlockDocument(artifactId);

      const result = await store.getState().commands.invokeCommand(
        BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID,
        {
          artifactId,
          blocks: [block],
        },
        {
          surface: 'ai',
          actor: BLOCK_DOCUMENT_AGENT_ACTOR,
        },
      );

      if (!result.success) {
        throw new Error(
          result.error ??
            result.message ??
            `Failed to execute ${BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID}`,
        );
      }

      return blockIdFromAppendResult(result.data, block);
    },

    updateBlock: async (artifactId, blockId, block) => {
      ensureBlockDocument(artifactId);

      const result = await store.getState().commands.invokeCommand(
        BLOCK_DOCUMENT_UPDATE_BLOCK_COMMAND_ID,
        {
          artifactId,
          blockId,
          block,
        },
        {
          surface: 'ai',
          actor: BLOCK_DOCUMENT_AGENT_ACTOR,
        },
      );

      if (!result.success) {
        throw new Error(
          result.error ??
            result.message ??
            `Failed to execute ${BLOCK_DOCUMENT_UPDATE_BLOCK_COMMAND_ID}`,
        );
      }
    },

    moveBlock: async (artifactId, blockId, toIndex) => {
      ensureBlockDocument(artifactId);

      const result = await store.getState().commands.invokeCommand(
        BLOCK_DOCUMENT_MOVE_BLOCK_COMMAND_ID,
        {
          artifactId,
          blockId,
          toIndex,
        },
        {
          surface: 'ai',
          actor: BLOCK_DOCUMENT_AGENT_ACTOR,
        },
      );

      if (!result.success) {
        throw new Error(
          result.error ??
            result.message ??
            `Failed to execute ${BLOCK_DOCUMENT_MOVE_BLOCK_COMMAND_ID}`,
        );
      }

      return true;
    },
  };
}
