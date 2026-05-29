import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {
  BlocksDocumentBlock,
  BlocksDocument,
  BlocksDocumentContent,
  BlocksDocumentsSliceConfig,
  blocksDocumentBlockToNode,
  blocksDocumentContentToBlocks,
  createEmptyBlocksDocumentContent,
  type BlocksDocumentBlock as BlocksDocumentBlockType,
  type BlocksDocument as BlocksDocumentType,
  type BlocksDocumentContent as BlocksDocumentContentType,
  type BlocksDocumentNode as BlocksDocumentNodeType,
  type BlocksDocumentsSliceConfig as BlocksDocumentsSliceConfigType,
} from './BlocksDocumentSliceConfig';

export type BlocksDocumentMutationOrigin = 'editor' | 'external';

export type BlocksDocumentMutationMetadata = {
  origin?: BlocksDocumentMutationOrigin;
  sourceId?: string;
};

export type BlocksDocumentSyncMetadata = {
  revision: number;
  origin: BlocksDocumentMutationOrigin;
  sourceId?: string;
};

export type BlocksDocumentsSliceState = {
  blocksDocuments: {
    config: BlocksDocumentsSliceConfigType;
    syncMetadata: Record<string, BlocksDocumentSyncMetadata>;
    setConfig: (config: BlocksDocumentsSliceConfigType) => void;
    ensureBlocksDocument: (
      artifactId: string,
      content?: BlocksDocumentContentType,
    ) => void;
    removeBlocksDocument: (artifactId: string) => void;
    setContent: (
      artifactId: string,
      content: BlocksDocumentContentType,
      metadata?: BlocksDocumentMutationMetadata,
    ) => void;
    appendBlocks: (artifactId: string, blocks: BlocksDocumentBlockType[]) => void;
    insertBlocks: (
      artifactId: string,
      index: number,
      blocks: BlocksDocumentBlockType[],
    ) => void;
    updateBlock: (
      artifactId: string,
      blockId: string,
      block: BlocksDocumentBlockType,
    ) => boolean;
    removeBlock: (artifactId: string, blockId: string) => boolean;
    moveBlock: (
      artifactId: string,
      blockId: string,
      toIndex: number,
    ) => boolean;
    getBlocksDocument: (artifactId: string) => BlocksDocumentType | undefined;
    getSyncMetadata: (
      artifactId: string,
    ) => BlocksDocumentSyncMetadata | undefined;
    getBlocks: (artifactId: string) => BlocksDocumentBlockType[];
  };
};

export type CreateBlocksDocumentsSliceProps = {
  config?: Partial<BlocksDocumentsSliceConfigType>;
  now?: () => number;
};

export function createDefaultBlocksDocumentsConfig(
  props: Partial<BlocksDocumentsSliceConfigType> = {},
): BlocksDocumentsSliceConfigType {
  return BlocksDocumentsSliceConfig.parse({artifacts: {}, ...props});
}

function normalizeContent(
  content: BlocksDocumentContentType | undefined,
): BlocksDocumentContentType {
  return BlocksDocumentContent.parse(
    content ?? createEmptyBlocksDocumentContent(),
  );
}

function nodesFromBlocks(
  blocks: BlocksDocumentBlockType[],
): BlocksDocumentNodeType[] {
  return blocks.map((block) =>
    blocksDocumentBlockToNode(BlocksDocumentBlock.parse(block)),
  );
}

function clampInsertIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return length;
  return Math.max(0, Math.min(length, Math.trunc(index)));
}

function getNodeId(node: BlocksDocumentNodeType): string | undefined {
  const id = node.attrs?.id;
  return typeof id === 'string' ? id : undefined;
}

function nextSyncMetadata(
  previous: BlocksDocumentSyncMetadata | undefined,
  metadata: BlocksDocumentMutationMetadata = {},
): BlocksDocumentSyncMetadata {
  return {
    revision: (previous?.revision ?? 0) + 1,
    origin: metadata.origin ?? 'external',
    ...(metadata.sourceId ? {sourceId: metadata.sourceId} : {}),
  };
}

export function createBlocksDocumentsSlice<
  TRoomState extends BaseRoomStoreState & BlocksDocumentsSliceState,
>(props: CreateBlocksDocumentsSliceProps = {}) {
  const now = props.now ?? Date.now;

  return createSlice<BlocksDocumentsSliceState, TRoomState>((set, get) => ({
    blocksDocuments: {
      config: createDefaultBlocksDocumentsConfig(props.config),
      syncMetadata: {},

      setConfig(config) {
        set((state) =>
          produce(state, (draft) => {
            draft.blocksDocuments.config =
              BlocksDocumentsSliceConfig.parse(config);
            const artifactIds = new Set(
              Object.keys(draft.blocksDocuments.config.artifacts),
            );
            for (const artifactId of artifactIds) {
              draft.blocksDocuments.syncMetadata[artifactId] =
                nextSyncMetadata(
                  draft.blocksDocuments.syncMetadata[artifactId],
                );
            }
            for (const artifactId of Object.keys(
              draft.blocksDocuments.syncMetadata,
            )) {
              if (!artifactIds.has(artifactId)) {
                delete draft.blocksDocuments.syncMetadata[artifactId];
              }
            }
          }),
        );
      },

      ensureBlocksDocument(artifactId, content) {
        set((state) =>
          produce(state, (draft) => {
            if (draft.blocksDocuments.config.artifacts[artifactId]) return;
            draft.blocksDocuments.config.artifacts[artifactId] =
              BlocksDocument.parse({
                id: artifactId,
                content: normalizeContent(content),
                updatedAt: now(),
              });
            draft.blocksDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blocksDocuments.syncMetadata[artifactId],
            );
          }),
        );
      },

      removeBlocksDocument(artifactId) {
        set((state) =>
          produce(state, (draft) => {
            delete draft.blocksDocuments.config.artifacts[artifactId];
            delete draft.blocksDocuments.syncMetadata[artifactId];
          }),
        );
      },

      setContent(artifactId, content, metadata) {
        set((state) =>
          produce(state, (draft) => {
            const parsedContent = normalizeContent(content);
            const existing =
              draft.blocksDocuments.config.artifacts[artifactId];
            if (existing) {
              existing.content = parsedContent;
              existing.updatedAt = now();
              draft.blocksDocuments.syncMetadata[artifactId] =
                nextSyncMetadata(
                  draft.blocksDocuments.syncMetadata[artifactId],
                  metadata,
                );
              return;
            }
            draft.blocksDocuments.config.artifacts[artifactId] =
              BlocksDocument.parse({
                id: artifactId,
                content: parsedContent,
                updatedAt: now(),
              });
            draft.blocksDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blocksDocuments.syncMetadata[artifactId],
              metadata,
            );
          }),
        );
      },

      appendBlocks(artifactId, blocks) {
        get().blocksDocuments.insertBlocks(
          artifactId,
          Number.POSITIVE_INFINITY,
          blocks,
        );
      },

      insertBlocks(artifactId, index, blocks) {
        const nodes = nodesFromBlocks(blocks);
        set((state) =>
          produce(state, (draft) => {
            const existing =
              draft.blocksDocuments.config.artifacts[artifactId];
            if (!existing) {
              draft.blocksDocuments.config.artifacts[artifactId] =
                BlocksDocument.parse({
                  id: artifactId,
                  content: {
                    type: 'doc',
                    content: nodes,
                  },
                  updatedAt: now(),
                });
              draft.blocksDocuments.syncMetadata[artifactId] =
                nextSyncMetadata(
                  draft.blocksDocuments.syncMetadata[artifactId],
                );
              return;
            }
            const content = existing.content.content;
            content.splice(
              clampInsertIndex(index, content.length),
              0,
              ...nodes,
            );
            existing.updatedAt = now();
            draft.blocksDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blocksDocuments.syncMetadata[artifactId],
            );
          }),
        );
      },

      updateBlock(artifactId, blockId, block) {
        let updated = false;
        const parsedBlock = BlocksDocumentBlock.parse({...block, id: blockId});
        const nextNode = blocksDocumentBlockToNode(parsedBlock);
        set((state) =>
          produce(state, (draft) => {
            const existing =
              draft.blocksDocuments.config.artifacts[artifactId];
            if (!existing) return;
            const index = existing.content.content.findIndex(
              (node) => getNodeId(node) === blockId,
            );
            if (index < 0) return;
            existing.content.content[index] = nextNode;
            existing.updatedAt = now();
            draft.blocksDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blocksDocuments.syncMetadata[artifactId],
            );
            updated = true;
          }),
        );
        return updated;
      },

      removeBlock(artifactId, blockId) {
        let removed = false;
        set((state) =>
          produce(state, (draft) => {
            const existing =
              draft.blocksDocuments.config.artifacts[artifactId];
            if (!existing) return;
            const nextContent = existing.content.content.filter(
              (node) => getNodeId(node) !== blockId,
            );
            if (nextContent.length === existing.content.content.length) return;
            existing.content.content = nextContent;
            existing.updatedAt = now();
            draft.blocksDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blocksDocuments.syncMetadata[artifactId],
            );
            removed = true;
          }),
        );
        return removed;
      },

      moveBlock(artifactId, blockId, toIndex) {
        let moved = false;
        set((state) =>
          produce(state, (draft) => {
            const existing =
              draft.blocksDocuments.config.artifacts[artifactId];
            if (!existing) return;
            const content = existing.content.content;
            const fromIndex = content.findIndex(
              (node) => getNodeId(node) === blockId,
            );
            if (fromIndex < 0) return;
            const [node] = content.splice(fromIndex, 1);
            if (!node) return;
            content.splice(clampInsertIndex(toIndex, content.length), 0, node);
            existing.updatedAt = now();
            draft.blocksDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blocksDocuments.syncMetadata[artifactId],
            );
            moved = true;
          }),
        );
        return moved;
      },

      getBlocksDocument(artifactId) {
        return get().blocksDocuments.config.artifacts[artifactId];
      },

      getSyncMetadata(artifactId) {
        return get().blocksDocuments.syncMetadata[artifactId];
      },

      getBlocks(artifactId) {
        const blocksDocument =
          get().blocksDocuments.config.artifacts[artifactId];
        return blocksDocument
          ? blocksDocumentContentToBlocks(blocksDocument.content)
          : [];
      },
    },
  }));
}
