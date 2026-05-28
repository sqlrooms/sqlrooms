import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {
  AnalysisBlock,
  AnalysisDocument,
  AnalysisDocumentContent,
  AnalysisDocumentsSliceConfig,
  analysisBlockToNode,
  analysisContentToBlocks,
  createEmptyAnalysisDocumentContent,
  type AnalysisBlock as AnalysisBlockType,
  type AnalysisDocument as AnalysisDocumentType,
  type AnalysisDocumentContent as AnalysisDocumentContentType,
  type AnalysisDocumentNode as AnalysisDocumentNodeType,
  type AnalysisDocumentsSliceConfig as AnalysisDocumentsSliceConfigType,
} from './AnalysisDocumentSliceConfig';

export type AnalysisDocumentMutationOrigin = 'editor' | 'external';

export type AnalysisDocumentMutationMetadata = {
  origin?: AnalysisDocumentMutationOrigin;
  sourceId?: string;
};

export type AnalysisDocumentSyncMetadata = {
  revision: number;
  origin: AnalysisDocumentMutationOrigin;
  sourceId?: string;
};

export type AnalysisDocumentsSliceState = {
  analysisDocuments: {
    config: AnalysisDocumentsSliceConfigType;
    syncMetadata: Record<string, AnalysisDocumentSyncMetadata>;
    setConfig: (config: AnalysisDocumentsSliceConfigType) => void;
    ensureAnalysis: (
      artifactId: string,
      content?: AnalysisDocumentContentType,
    ) => void;
    removeAnalysis: (artifactId: string) => void;
    setContent: (
      artifactId: string,
      content: AnalysisDocumentContentType,
      metadata?: AnalysisDocumentMutationMetadata,
    ) => void;
    appendBlocks: (artifactId: string, blocks: AnalysisBlockType[]) => void;
    insertBlocks: (
      artifactId: string,
      index: number,
      blocks: AnalysisBlockType[],
    ) => void;
    updateBlock: (
      artifactId: string,
      blockId: string,
      block: AnalysisBlockType,
    ) => boolean;
    removeBlock: (artifactId: string, blockId: string) => boolean;
    moveBlock: (
      artifactId: string,
      blockId: string,
      toIndex: number,
    ) => boolean;
    getAnalysis: (artifactId: string) => AnalysisDocumentType | undefined;
    getSyncMetadata: (
      artifactId: string,
    ) => AnalysisDocumentSyncMetadata | undefined;
    getBlocks: (artifactId: string) => AnalysisBlockType[];
  };
};

export type CreateAnalysisDocumentsSliceProps = {
  config?: Partial<AnalysisDocumentsSliceConfigType>;
  now?: () => number;
};

export function createDefaultAnalysisDocumentsConfig(
  props: Partial<AnalysisDocumentsSliceConfigType> = {},
): AnalysisDocumentsSliceConfigType {
  return AnalysisDocumentsSliceConfig.parse({artifacts: {}, ...props});
}

function normalizeContent(
  content: AnalysisDocumentContentType | undefined,
): AnalysisDocumentContentType {
  return AnalysisDocumentContent.parse(
    content ?? createEmptyAnalysisDocumentContent(),
  );
}

function nodesFromBlocks(
  blocks: AnalysisBlockType[],
): AnalysisDocumentNodeType[] {
  return blocks.map((block) => analysisBlockToNode(AnalysisBlock.parse(block)));
}

function clampInsertIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) return length;
  return Math.max(0, Math.min(length, Math.trunc(index)));
}

function getNodeId(node: AnalysisDocumentNodeType): string | undefined {
  const id = node.attrs?.id;
  return typeof id === 'string' ? id : undefined;
}

function nextSyncMetadata(
  previous: AnalysisDocumentSyncMetadata | undefined,
  metadata: AnalysisDocumentMutationMetadata = {},
): AnalysisDocumentSyncMetadata {
  return {
    revision: (previous?.revision ?? 0) + 1,
    origin: metadata.origin ?? 'external',
    ...(metadata.sourceId ? {sourceId: metadata.sourceId} : {}),
  };
}

export function createAnalysisDocumentsSlice<
  TRoomState extends BaseRoomStoreState & AnalysisDocumentsSliceState,
>(props: CreateAnalysisDocumentsSliceProps = {}) {
  const now = props.now ?? Date.now;

  return createSlice<AnalysisDocumentsSliceState, TRoomState>((set, get) => ({
    analysisDocuments: {
      config: createDefaultAnalysisDocumentsConfig(props.config),
      syncMetadata: {},

      setConfig(config) {
        set((state) =>
          produce(state, (draft) => {
            draft.analysisDocuments.config =
              AnalysisDocumentsSliceConfig.parse(config);
            const artifactIds = new Set(
              Object.keys(draft.analysisDocuments.config.artifacts),
            );
            for (const artifactId of artifactIds) {
              draft.analysisDocuments.syncMetadata[artifactId] =
                nextSyncMetadata(
                  draft.analysisDocuments.syncMetadata[artifactId],
                );
            }
            for (const artifactId of Object.keys(
              draft.analysisDocuments.syncMetadata,
            )) {
              if (!artifactIds.has(artifactId)) {
                delete draft.analysisDocuments.syncMetadata[artifactId];
              }
            }
          }),
        );
      },

      ensureAnalysis(artifactId, content) {
        set((state) =>
          produce(state, (draft) => {
            if (draft.analysisDocuments.config.artifacts[artifactId]) return;
            draft.analysisDocuments.config.artifacts[artifactId] =
              AnalysisDocument.parse({
                id: artifactId,
                content: normalizeContent(content),
                updatedAt: now(),
              });
            draft.analysisDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.analysisDocuments.syncMetadata[artifactId],
            );
          }),
        );
      },

      removeAnalysis(artifactId) {
        set((state) =>
          produce(state, (draft) => {
            delete draft.analysisDocuments.config.artifacts[artifactId];
            delete draft.analysisDocuments.syncMetadata[artifactId];
          }),
        );
      },

      setContent(artifactId, content, metadata) {
        set((state) =>
          produce(state, (draft) => {
            const parsedContent = normalizeContent(content);
            const existing =
              draft.analysisDocuments.config.artifacts[artifactId];
            if (existing) {
              existing.content = parsedContent;
              existing.updatedAt = now();
              draft.analysisDocuments.syncMetadata[artifactId] =
                nextSyncMetadata(
                  draft.analysisDocuments.syncMetadata[artifactId],
                  metadata,
                );
              return;
            }
            draft.analysisDocuments.config.artifacts[artifactId] =
              AnalysisDocument.parse({
                id: artifactId,
                content: parsedContent,
                updatedAt: now(),
              });
            draft.analysisDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.analysisDocuments.syncMetadata[artifactId],
              metadata,
            );
          }),
        );
      },

      appendBlocks(artifactId, blocks) {
        get().analysisDocuments.insertBlocks(
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
              draft.analysisDocuments.config.artifacts[artifactId];
            if (!existing) {
              draft.analysisDocuments.config.artifacts[artifactId] =
                AnalysisDocument.parse({
                  id: artifactId,
                  content: {
                    type: 'doc',
                    content: nodes,
                  },
                  updatedAt: now(),
                });
              draft.analysisDocuments.syncMetadata[artifactId] =
                nextSyncMetadata(
                  draft.analysisDocuments.syncMetadata[artifactId],
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
            draft.analysisDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.analysisDocuments.syncMetadata[artifactId],
            );
          }),
        );
      },

      updateBlock(artifactId, blockId, block) {
        let updated = false;
        const parsedBlock = AnalysisBlock.parse({...block, id: blockId});
        const nextNode = analysisBlockToNode(parsedBlock);
        set((state) =>
          produce(state, (draft) => {
            const existing =
              draft.analysisDocuments.config.artifacts[artifactId];
            if (!existing) return;
            const index = existing.content.content.findIndex(
              (node) => getNodeId(node) === blockId,
            );
            if (index < 0) return;
            existing.content.content[index] = nextNode;
            existing.updatedAt = now();
            draft.analysisDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.analysisDocuments.syncMetadata[artifactId],
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
              draft.analysisDocuments.config.artifacts[artifactId];
            if (!existing) return;
            const nextContent = existing.content.content.filter(
              (node) => getNodeId(node) !== blockId,
            );
            if (nextContent.length === existing.content.content.length) return;
            existing.content.content = nextContent;
            existing.updatedAt = now();
            draft.analysisDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.analysisDocuments.syncMetadata[artifactId],
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
              draft.analysisDocuments.config.artifacts[artifactId];
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
            draft.analysisDocuments.syncMetadata[artifactId] = nextSyncMetadata(
              draft.analysisDocuments.syncMetadata[artifactId],
            );
            moved = true;
          }),
        );
        return moved;
      },

      getAnalysis(artifactId) {
        return get().analysisDocuments.config.artifacts[artifactId];
      },

      getSyncMetadata(artifactId) {
        return get().analysisDocuments.syncMetadata[artifactId];
      },

      getBlocks(artifactId) {
        const analysis = get().analysisDocuments.config.artifacts[artifactId];
        return analysis ? analysisContentToBlocks(analysis.content) : [];
      },
    },
  }));
}
