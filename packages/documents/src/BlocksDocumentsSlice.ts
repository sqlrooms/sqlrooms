import type {BlockOwnership} from '@sqlrooms/blocks';
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

export type BlocksDocumentStatefulBlockReference = {
  documentId: string;
  blockId: string;
  blockType: string;
  blockInstanceId: string;
  ownership: BlockOwnership;
  title?: string;
  caption?: string;
};

export type BlocksDocumentOwnedStatefulBlockReference =
  BlocksDocumentStatefulBlockReference & {
    ownership: 'owned';
  };

export type BlocksDocumentOwnedStatefulBlockDeleteContext<TRoomState> =
  BlocksDocumentOwnedStatefulBlockReference & {
    getState: () => TRoomState;
  };

export type BlocksDocumentOwnedStatefulBlockCreateContext<TRoomState> =
  BlocksDocumentOwnedStatefulBlockReference & {
    getState: () => TRoomState;
  };

export type BlocksDocumentOwnedStatefulBlockRenameContext<TRoomState> =
  BlocksDocumentOwnedStatefulBlockReference & {
    previousTitle: string;
    title: string;
    getState: () => TRoomState;
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
    appendBlocks: (
      artifactId: string,
      blocks: BlocksDocumentBlockType[],
    ) => void;
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

export type CreateBlocksDocumentsSliceProps<
  TRoomState extends BaseRoomStoreState & BlocksDocumentsSliceState =
    BaseRoomStoreState & BlocksDocumentsSliceState,
> = {
  config?: Partial<BlocksDocumentsSliceConfigType>;
  now?: () => number;
  onDeleteOwnedStatefulBlock?: (
    context: BlocksDocumentOwnedStatefulBlockDeleteContext<TRoomState>,
  ) => void;
  onCreateOwnedStatefulBlock?: (
    context: BlocksDocumentOwnedStatefulBlockCreateContext<TRoomState>,
  ) => void;
  onRenameOwnedStatefulBlock?: (
    context: BlocksDocumentOwnedStatefulBlockRenameContext<TRoomState>,
  ) => void;
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

function statefulBlockReferenceKey(
  reference: Pick<
    BlocksDocumentStatefulBlockReference,
    'blockType' | 'blockInstanceId'
  >,
) {
  return `${reference.blockType}\u0000${reference.blockInstanceId}`;
}

function getOwnedStatefulBlockReferences(
  config: BlocksDocumentsSliceConfigType,
): BlocksDocumentOwnedStatefulBlockReference[] {
  const references: BlocksDocumentOwnedStatefulBlockReference[] = [];
  for (const [documentId, blocksDocument] of Object.entries(config.artifacts)) {
    for (const block of blocksDocumentContentToBlocks(blocksDocument.content)) {
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
  previousConfig: BlocksDocumentsSliceConfigType,
  nextConfig: BlocksDocumentsSliceConfigType,
): BlocksDocumentOwnedStatefulBlockReference[] {
  const nextReferenceKeys = new Set<string>();
  for (const reference of getOwnedStatefulBlockReferences(nextConfig)) {
    nextReferenceKeys.add(statefulBlockReferenceKey(reference));
  }

  const removedReferences: BlocksDocumentOwnedStatefulBlockReference[] = [];
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
  previousConfig: BlocksDocumentsSliceConfigType,
  nextConfig: BlocksDocumentsSliceConfigType,
): BlocksDocumentOwnedStatefulBlockReference[] {
  const previousReferenceKeys = new Set<string>();
  for (const reference of getOwnedStatefulBlockReferences(previousConfig)) {
    previousReferenceKeys.add(statefulBlockReferenceKey(reference));
  }

  const addedReferences: BlocksDocumentOwnedStatefulBlockReference[] = [];
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
  previousConfig: BlocksDocumentsSliceConfigType,
  nextConfig: BlocksDocumentsSliceConfigType,
): Array<
  BlocksDocumentOwnedStatefulBlockReference & {
    previousTitle: string;
    title: string;
  }
> {
  const previousReferences = new Map<
    string,
    BlocksDocumentOwnedStatefulBlockReference
  >();
  for (const reference of getOwnedStatefulBlockReferences(previousConfig)) {
    previousReferences.set(statefulBlockReferenceKey(reference), reference);
  }

  const renamedReferences: Array<
    BlocksDocumentOwnedStatefulBlockReference & {
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
>(props: CreateBlocksDocumentsSliceProps<TRoomState> = {}) {
  const now = props.now ?? Date.now;

  const runOwnedStatefulBlockCreate = (
    previousConfig: BlocksDocumentsSliceConfigType,
    getState: () => TRoomState,
  ) => {
    if (!props.onCreateOwnedStatefulBlock) return;
    const addedReferences = findAddedOwnedStatefulBlockReferences(
      previousConfig,
      getState().blocksDocuments.config,
    );
    for (const reference of addedReferences) {
      props.onCreateOwnedStatefulBlock({
        ...reference,
        getState,
      });
    }
  };

  const runOwnedStatefulBlockCleanup = (
    previousConfig: BlocksDocumentsSliceConfigType,
    getState: () => TRoomState,
  ) => {
    if (!props.onDeleteOwnedStatefulBlock) return;
    const removedReferences = findRemovedOwnedStatefulBlockReferences(
      previousConfig,
      getState().blocksDocuments.config,
    );
    for (const reference of removedReferences) {
      props.onDeleteOwnedStatefulBlock({
        ...reference,
        getState,
      });
    }
  };

  const runOwnedStatefulBlockRename = (
    previousConfig: BlocksDocumentsSliceConfigType,
    getState: () => TRoomState,
  ) => {
    if (!props.onRenameOwnedStatefulBlock) return;
    const renamedReferences = findRenamedOwnedStatefulBlockReferences(
      previousConfig,
      getState().blocksDocuments.config,
    );
    for (const reference of renamedReferences) {
      props.onRenameOwnedStatefulBlock({
        ...reference,
        getState,
      });
    }
  };

  return createSlice<BlocksDocumentsSliceState, TRoomState>((set, get) => ({
    blocksDocuments: {
      config: createDefaultBlocksDocumentsConfig(props.config),
      syncMetadata: {},

      setConfig(config) {
        const previousConfig = get().blocksDocuments.config;
        set((state) =>
          produce(state, (draft) => {
            draft.blocksDocuments.config =
              BlocksDocumentsSliceConfig.parse(config);
            const artifactIds = new Set(
              Object.keys(draft.blocksDocuments.config.artifacts),
            );
            for (const artifactId of artifactIds) {
              draft.blocksDocuments.syncMetadata[artifactId] = nextSyncMetadata(
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
        runOwnedStatefulBlockCreate(previousConfig, get);
        runOwnedStatefulBlockRename(previousConfig, get);
        runOwnedStatefulBlockCleanup(previousConfig, get);
      },

      ensureBlocksDocument(artifactId, content) {
        const previousConfig = get().blocksDocuments.config;
        let created = false;
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
            created = true;
          }),
        );
        if (created) {
          runOwnedStatefulBlockCreate(previousConfig, get);
        }
      },

      removeBlocksDocument(artifactId) {
        const previousConfig = get().blocksDocuments.config;
        set((state) =>
          produce(state, (draft) => {
            delete draft.blocksDocuments.config.artifacts[artifactId];
            delete draft.blocksDocuments.syncMetadata[artifactId];
          }),
        );
        runOwnedStatefulBlockRename(previousConfig, get);
        runOwnedStatefulBlockCleanup(previousConfig, get);
      },

      setContent(artifactId, content, metadata) {
        const previousConfig = get().blocksDocuments.config;
        set((state) =>
          produce(state, (draft) => {
            const parsedContent = normalizeContent(content);
            const existing = draft.blocksDocuments.config.artifacts[artifactId];
            if (existing) {
              existing.content = parsedContent;
              existing.updatedAt = now();
              draft.blocksDocuments.syncMetadata[artifactId] = nextSyncMetadata(
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
        runOwnedStatefulBlockCreate(previousConfig, get);
        runOwnedStatefulBlockRename(previousConfig, get);
        runOwnedStatefulBlockCleanup(previousConfig, get);
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
        const previousConfig = get().blocksDocuments.config;
        set((state) =>
          produce(state, (draft) => {
            const existing = draft.blocksDocuments.config.artifacts[artifactId];
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
              draft.blocksDocuments.syncMetadata[artifactId] = nextSyncMetadata(
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
        runOwnedStatefulBlockCreate(previousConfig, get);
      },

      updateBlock(artifactId, blockId, block) {
        let updated = false;
        const previousConfig = get().blocksDocuments.config;
        const parsedBlock = BlocksDocumentBlock.parse({...block, id: blockId});
        const nextNode = blocksDocumentBlockToNode(parsedBlock);
        set((state) =>
          produce(state, (draft) => {
            const existing = draft.blocksDocuments.config.artifacts[artifactId];
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
        if (updated) {
          runOwnedStatefulBlockCreate(previousConfig, get);
          runOwnedStatefulBlockRename(previousConfig, get);
          runOwnedStatefulBlockCleanup(previousConfig, get);
        }
        return updated;
      },

      removeBlock(artifactId, blockId) {
        let removed = false;
        const previousConfig = get().blocksDocuments.config;
        set((state) =>
          produce(state, (draft) => {
            const existing = draft.blocksDocuments.config.artifacts[artifactId];
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
        if (removed) {
          runOwnedStatefulBlockCleanup(previousConfig, get);
        }
        return removed;
      },

      moveBlock(artifactId, blockId, toIndex) {
        let moved = false;
        set((state) =>
          produce(state, (draft) => {
            const existing = draft.blocksDocuments.config.artifacts[artifactId];
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
