import type {BlockOwnership} from '@sqlrooms/blocks';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {
  BlockDocumentBlock,
  BlockDocument,
  BlockDocumentContent,
  BlockDocumentsSliceConfig,
  blockDocumentBlockToNode,
  blockDocumentContentToBlocks,
  createEmptyBlockDocumentContent,
  type BlockDocumentBlock as BlockDocumentBlockType,
  type BlockDocument as BlockDocumentType,
  type BlockDocumentContent as BlockDocumentContentType,
  type BlockDocumentNode as BlockDocumentNodeType,
  type BlockDocumentsSliceConfig as BlockDocumentsSliceConfigType,
} from './BlockDocumentSliceConfig';

export type BlockDocumentMutationOrigin = 'editor' | 'external';

export type BlockDocumentMutationMetadata = {
  origin?: BlockDocumentMutationOrigin;
  sourceId?: string;
};

export type BlockDocumentSyncMetadata = {
  revision: number;
  origin: BlockDocumentMutationOrigin;
  sourceId?: string;
};

export type BlockDocumentStatefulBlockReference = {
  documentId: string;
  blockId: string;
  blockType: string;
  blockInstanceId: string;
  ownership: BlockOwnership;
  title?: string;
  caption?: string;
};

export type BlockDocumentOwnedStatefulBlockReference =
  BlockDocumentStatefulBlockReference & {
    ownership: 'owned';
  };

export type BlockDocumentOwnedStatefulBlockDeleteContext<TRoomState> =
  BlockDocumentOwnedStatefulBlockReference & {
    getState: () => TRoomState;
  };

export type BlockDocumentOwnedStatefulBlockCreateContext<TRoomState> =
  BlockDocumentOwnedStatefulBlockReference & {
    getState: () => TRoomState;
  };

export type BlockDocumentOwnedStatefulBlockRenameContext<TRoomState> =
  BlockDocumentOwnedStatefulBlockReference & {
    previousTitle: string;
    title: string;
    getState: () => TRoomState;
  };

export type BlockDocumentsSliceState = {
  blockDocuments: {
    config: BlockDocumentsSliceConfigType;
    syncMetadata: Record<string, BlockDocumentSyncMetadata>;
    setConfig: (config: BlockDocumentsSliceConfigType) => void;
    ensureBlockDocument: (
      artifactId: string,
      content?: BlockDocumentContentType,
    ) => void;
    removeBlockDocument: (artifactId: string) => void;
    setContent: (
      artifactId: string,
      content: BlockDocumentContentType,
      metadata?: BlockDocumentMutationMetadata,
    ) => void;
    appendBlocks: (
      artifactId: string,
      blocks: BlockDocumentBlockType[],
    ) => void;
    insertBlocks: (
      artifactId: string,
      index: number,
      blocks: BlockDocumentBlockType[],
    ) => void;
    updateBlock: (
      artifactId: string,
      blockId: string,
      block: BlockDocumentBlockType,
    ) => boolean;
    removeBlock: (artifactId: string, blockId: string) => boolean;
    moveBlock: (
      artifactId: string,
      blockId: string,
      toIndex: number,
    ) => boolean;
    getBlockDocument: (artifactId: string) => BlockDocumentType | undefined;
    getSyncMetadata: (
      artifactId: string,
    ) => BlockDocumentSyncMetadata | undefined;
    getBlocks: (artifactId: string) => BlockDocumentBlockType[];
  };
};

export type CreateBlockDocumentsSliceProps<
  TRoomState extends BaseRoomStoreState & BlockDocumentsSliceState =
    BaseRoomStoreState & BlockDocumentsSliceState,
> = {
  config?: Partial<BlockDocumentsSliceConfigType>;
  now?: () => number;
  onDeleteOwnedStatefulBlock?: (
    context: BlockDocumentOwnedStatefulBlockDeleteContext<TRoomState>,
  ) => void;
  onCreateOwnedStatefulBlock?: (
    context: BlockDocumentOwnedStatefulBlockCreateContext<TRoomState>,
  ) => void;
  onRenameOwnedStatefulBlock?: (
    context: BlockDocumentOwnedStatefulBlockRenameContext<TRoomState>,
  ) => void;
};

export function createDefaultBlockDocumentsConfig(
  props: Partial<BlockDocumentsSliceConfigType> = {},
): BlockDocumentsSliceConfigType {
  return BlockDocumentsSliceConfig.parse({artifacts: {}, ...props});
}

function normalizeContent(
  content: BlockDocumentContentType | undefined,
): BlockDocumentContentType {
  return BlockDocumentContent.parse(
    content ?? createEmptyBlockDocumentContent(),
  );
}

function nodesFromBlocks(
  blocks: BlockDocumentBlockType[],
): BlockDocumentNodeType[] {
  return blocks.map((block) =>
    blockDocumentBlockToNode(BlockDocumentBlock.parse(block)),
  );
}

function clampInsertIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return length;
  return Math.max(0, Math.min(length, Math.trunc(index)));
}

function getNodeId(node: BlockDocumentNodeType): string | undefined {
  const id = node.attrs?.id;
  return typeof id === 'string' ? id : undefined;
}

function statefulBlockReferenceKey(
  reference: Pick<
    BlockDocumentStatefulBlockReference,
    'blockType' | 'blockInstanceId'
  >,
) {
  return `${reference.blockType}\u0000${reference.blockInstanceId}`;
}

function getOwnedStatefulBlockReferences(
  config: BlockDocumentsSliceConfigType,
): BlockDocumentOwnedStatefulBlockReference[] {
  const references: BlockDocumentOwnedStatefulBlockReference[] = [];
  for (const [documentId, blockDocument] of Object.entries(config.artifacts)) {
    for (const block of blockDocumentContentToBlocks(blockDocument.content)) {
      if (block.type !== 'statefulBlock') continue;
      const ownership = block.ownership ?? 'owned';
      if (ownership !== 'owned') continue;
      references.push({
        documentId,
        blockId: block.id,
        blockType: block.blockType,
        blockInstanceId: block.blockInstanceId,
        ownership,
        title: block.title,
        caption: block.caption,
      });
    }
  }
  return references;
}

function findRemovedOwnedStatefulBlockReferences(
  previousConfig: BlockDocumentsSliceConfigType,
  nextConfig: BlockDocumentsSliceConfigType,
): BlockDocumentOwnedStatefulBlockReference[] {
  const nextReferenceKeys = new Set<string>();
  for (const reference of getOwnedStatefulBlockReferences(nextConfig)) {
    nextReferenceKeys.add(statefulBlockReferenceKey(reference));
  }

  const removedReferences: BlockDocumentOwnedStatefulBlockReference[] = [];
  const removedReferenceKeys = new Set<string>();
  for (const reference of getOwnedStatefulBlockReferences(previousConfig)) {
    const key = statefulBlockReferenceKey(reference);
    if (nextReferenceKeys.has(key) || removedReferenceKeys.has(key)) continue;
    removedReferences.push(reference);
    removedReferenceKeys.add(key);
  }
  return removedReferences;
}

function findAddedOwnedStatefulBlockReferences(
  previousConfig: BlockDocumentsSliceConfigType,
  nextConfig: BlockDocumentsSliceConfigType,
): BlockDocumentOwnedStatefulBlockReference[] {
  const previousReferenceKeys = new Set<string>();
  for (const reference of getOwnedStatefulBlockReferences(previousConfig)) {
    previousReferenceKeys.add(statefulBlockReferenceKey(reference));
  }

  const addedReferences: BlockDocumentOwnedStatefulBlockReference[] = [];
  const addedReferenceKeys = new Set<string>();
  for (const reference of getOwnedStatefulBlockReferences(nextConfig)) {
    const key = statefulBlockReferenceKey(reference);
    if (previousReferenceKeys.has(key) || addedReferenceKeys.has(key)) continue;
    addedReferences.push(reference);
    addedReferenceKeys.add(key);
  }
  return addedReferences;
}

function findRenamedOwnedStatefulBlockReferences(
  previousConfig: BlockDocumentsSliceConfigType,
  nextConfig: BlockDocumentsSliceConfigType,
): Array<
  BlockDocumentOwnedStatefulBlockReference & {
    previousTitle: string;
    title: string;
  }
> {
  const previousReferences = new Map<
    string,
    BlockDocumentOwnedStatefulBlockReference
  >();
  for (const reference of getOwnedStatefulBlockReferences(previousConfig)) {
    previousReferences.set(statefulBlockReferenceKey(reference), reference);
  }

  const renamedReferences: Array<
    BlockDocumentOwnedStatefulBlockReference & {
      previousTitle: string;
      title: string;
    }
  > = [];
  for (const reference of getOwnedStatefulBlockReferences(nextConfig)) {
    const previousReference = previousReferences.get(
      statefulBlockReferenceKey(reference),
    );
    if (!previousReference) continue;
    const previousTitle = previousReference.title ?? '';
    const title = reference.title ?? '';
    if (!title || previousTitle === title) continue;
    renamedReferences.push({...reference, previousTitle, title});
  }
  return renamedReferences;
}

function nextSyncMetadata(
  previous: BlockDocumentSyncMetadata | undefined,
  metadata: BlockDocumentMutationMetadata = {},
): BlockDocumentSyncMetadata {
  return {
    revision: (previous?.revision ?? 0) + 1,
    origin: metadata.origin ?? 'external',
    ...(metadata.sourceId ? {sourceId: metadata.sourceId} : {}),
  };
}

export function createBlockDocumentsSlice<
  TRoomState extends BaseRoomStoreState & BlockDocumentsSliceState,
>(props: CreateBlockDocumentsSliceProps<TRoomState> = {}) {
  const now = props.now ?? Date.now;

  const runOwnedStatefulBlockCreate = (
    previousConfig: BlockDocumentsSliceConfigType,
    getState: () => TRoomState,
  ) => {
    if (!props.onCreateOwnedStatefulBlock) return;
    const addedReferences = findAddedOwnedStatefulBlockReferences(
      previousConfig,
      getState().blockDocuments.config,
    );
    for (const reference of addedReferences) {
      props.onCreateOwnedStatefulBlock({
        ...reference,
        getState,
      });
    }
  };

  const runOwnedStatefulBlockCleanup = (
    previousConfig: BlockDocumentsSliceConfigType,
    getState: () => TRoomState,
  ) => {
    if (!props.onDeleteOwnedStatefulBlock) return;
    const removedReferences = findRemovedOwnedStatefulBlockReferences(
      previousConfig,
      getState().blockDocuments.config,
    );
    for (const reference of removedReferences) {
      props.onDeleteOwnedStatefulBlock({
        ...reference,
        getState,
      });
    }
  };

  const runOwnedStatefulBlockRename = (
    previousConfig: BlockDocumentsSliceConfigType,
    getState: () => TRoomState,
  ) => {
    if (!props.onRenameOwnedStatefulBlock) return;
    const renamedReferences = findRenamedOwnedStatefulBlockReferences(
      previousConfig,
      getState().blockDocuments.config,
    );
    for (const reference of renamedReferences) {
      props.onRenameOwnedStatefulBlock({
        ...reference,
        getState,
      });
    }
  };

  return createSlice<BlockDocumentsSliceState, TRoomState>((set, get) => ({
    blockDocuments: {
      config: createDefaultBlockDocumentsConfig(props.config),
      syncMetadata: {},

      setConfig(config) {
        const previousConfig = get().blockDocuments.config;
        set((state) =>
          produce(state, (draft) => {
            draft.blockDocuments.config =
              BlockDocumentsSliceConfig.parse(config);
            const artifactIds = new Set(
              Object.keys(draft.blockDocuments.config.artifacts),
            );
            for (const artifactId of artifactIds) {
              draft.blockDocuments.syncMetadata[artifactId] = nextSyncMetadata(
                draft.blockDocuments.syncMetadata[artifactId],
              );
            }
            for (const artifactId of Object.keys(
              draft.blockDocuments.syncMetadata,
            )) {
              if (!artifactIds.has(artifactId)) {
                delete draft.blockDocuments.syncMetadata[artifactId];
              }
            }
          }),
        );
        runOwnedStatefulBlockCreate(previousConfig, get);
        runOwnedStatefulBlockRename(previousConfig, get);
        runOwnedStatefulBlockCleanup(previousConfig, get);
      },

      ensureBlockDocument(artifactId, content) {
        const previousConfig = get().blockDocuments.config;
        let created = false;
        set((state) =>
          produce(state, (draft) => {
            if (draft.blockDocuments.config.artifacts[artifactId]) return;
            draft.blockDocuments.config.artifacts[artifactId] =
              BlockDocument.parse({
                id: artifactId,
                content: normalizeContent(content),
                updatedAt: now(),
              });
            draft.blockDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blockDocuments.syncMetadata[artifactId],
            );
            created = true;
          }),
        );
        if (created) {
          runOwnedStatefulBlockCreate(previousConfig, get);
        }
      },

      removeBlockDocument(artifactId) {
        const previousConfig = get().blockDocuments.config;
        set((state) =>
          produce(state, (draft) => {
            delete draft.blockDocuments.config.artifacts[artifactId];
            delete draft.blockDocuments.syncMetadata[artifactId];
          }),
        );
        runOwnedStatefulBlockRename(previousConfig, get);
        runOwnedStatefulBlockCleanup(previousConfig, get);
      },

      setContent(artifactId, content, metadata) {
        const previousConfig = get().blockDocuments.config;
        set((state) =>
          produce(state, (draft) => {
            const parsedContent = normalizeContent(content);
            const existing = draft.blockDocuments.config.artifacts[artifactId];
            if (existing) {
              existing.content = parsedContent;
              existing.updatedAt = now();
              draft.blockDocuments.syncMetadata[artifactId] = nextSyncMetadata(
                draft.blockDocuments.syncMetadata[artifactId],
                metadata,
              );
              return;
            }
            draft.blockDocuments.config.artifacts[artifactId] =
              BlockDocument.parse({
                id: artifactId,
                content: parsedContent,
                updatedAt: now(),
              });
            draft.blockDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blockDocuments.syncMetadata[artifactId],
              metadata,
            );
          }),
        );
        runOwnedStatefulBlockCreate(previousConfig, get);
        runOwnedStatefulBlockRename(previousConfig, get);
        runOwnedStatefulBlockCleanup(previousConfig, get);
      },

      appendBlocks(artifactId, blocks) {
        get().blockDocuments.insertBlocks(
          artifactId,
          Number.POSITIVE_INFINITY,
          blocks,
        );
      },

      insertBlocks(artifactId, index, blocks) {
        const nodes = nodesFromBlocks(blocks);
        const previousConfig = get().blockDocuments.config;
        set((state) =>
          produce(state, (draft) => {
            const existing = draft.blockDocuments.config.artifacts[artifactId];
            if (!existing) {
              draft.blockDocuments.config.artifacts[artifactId] =
                BlockDocument.parse({
                  id: artifactId,
                  content: {
                    type: 'doc',
                    content: nodes,
                  },
                  updatedAt: now(),
                });
              draft.blockDocuments.syncMetadata[artifactId] = nextSyncMetadata(
                draft.blockDocuments.syncMetadata[artifactId],
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
            draft.blockDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blockDocuments.syncMetadata[artifactId],
            );
          }),
        );
        runOwnedStatefulBlockCreate(previousConfig, get);
      },

      updateBlock(artifactId, blockId, block) {
        let updated = false;
        const previousConfig = get().blockDocuments.config;
        const parsedBlock = BlockDocumentBlock.parse({...block, id: blockId});
        const nextNode = blockDocumentBlockToNode(parsedBlock);
        set((state) =>
          produce(state, (draft) => {
            const existing = draft.blockDocuments.config.artifacts[artifactId];
            if (!existing) return;
            const index = existing.content.content.findIndex(
              (node) => getNodeId(node) === blockId,
            );
            if (index < 0) return;
            existing.content.content[index] = nextNode;
            existing.updatedAt = now();
            draft.blockDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blockDocuments.syncMetadata[artifactId],
            );
            updated = true;
          }),
        );
        if (updated) {
          runOwnedStatefulBlockCreate(previousConfig, get);
          runOwnedStatefulBlockRename(previousConfig, get);
          runOwnedStatefulBlockCleanup(previousConfig, get);
        }
        return updated;
      },

      removeBlock(artifactId, blockId) {
        let removed = false;
        const previousConfig = get().blockDocuments.config;
        set((state) =>
          produce(state, (draft) => {
            const existing = draft.blockDocuments.config.artifacts[artifactId];
            if (!existing) return;
            const nextContent = existing.content.content.filter(
              (node) => getNodeId(node) !== blockId,
            );
            if (nextContent.length === existing.content.content.length) return;
            existing.content.content = nextContent;
            existing.updatedAt = now();
            draft.blockDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blockDocuments.syncMetadata[artifactId],
            );
            removed = true;
          }),
        );
        if (removed) {
          runOwnedStatefulBlockCleanup(previousConfig, get);
        }
        return removed;
      },

      moveBlock(artifactId, blockId, toIndex) {
        let moved = false;
        set((state) =>
          produce(state, (draft) => {
            const existing = draft.blockDocuments.config.artifacts[artifactId];
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
            draft.blockDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.blockDocuments.syncMetadata[artifactId],
            );
            moved = true;
          }),
        );
        return moved;
      },

      getBlockDocument(artifactId) {
        return get().blockDocuments.config.artifacts[artifactId];
      },

      getSyncMetadata(artifactId) {
        return get().blockDocuments.syncMetadata[artifactId];
      },

      getBlocks(artifactId) {
        const blockDocument = get().blockDocuments.config.artifacts[artifactId];
        return blockDocument
          ? blockDocumentContentToBlocks(blockDocument.content)
          : [];
      },
    },
  }));
}
