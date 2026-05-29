import type {Editor} from '@tiptap/react';
import {createContext, useContext} from 'react';
import type {
  BlocksDocumentContent,
  BlocksDocumentNode,
} from '../BlocksDocumentSliceConfig';
import type {BlocksDocumentMutationMetadata} from '../BlocksDocumentsSlice';
import type {DocumentAsset} from '../DocumentsSliceConfig';

export type BlocksDocumentEditorChangeHandler = (
  value: BlocksDocumentContent,
  metadata?: BlocksDocumentMutationMetadata,
) => void;

export type BlocksDocumentEditorContextValue = {
  editor: Editor | null;
  documentId: string;
  value: BlocksDocumentContent;
  assets: Record<string, DocumentAsset>;
  onChange: BlocksDocumentEditorChangeHandler;
  readOnly: boolean;
  generateBlockId: () => string;
};

export const BlocksDocumentEditorContext =
  createContext<BlocksDocumentEditorContextValue | null>(null);

export function useBlocksDocumentEditorContext() {
  const context = useContext(BlocksDocumentEditorContext);
  if (!context) {
    throw new Error(
      'BlocksDocumentEditor compound components must be used within BlocksDocumentEditor.Root',
    );
  }
  return context;
}

function defaultGenerateBlockId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) {
    return randomUUID.call(globalThis.crypto);
  }
  return `blocks-document-block-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function stringAttr(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

type BlocksDocumentNormalizationState = {
  seenBlockIds: Set<string>;
  seenOwnedStatefulBlockKeys: Set<string>;
};

function statefulBlockKey(
  blockType: string | undefined,
  blockInstanceId: string,
) {
  return `${blockType ?? ''}\u0000${blockInstanceId}`;
}

function uniqueOwnedStatefulBlockInstanceId(
  blockType: string | undefined,
  preferredId: string,
  generateBlockId: () => string,
  seenKeys: Set<string>,
) {
  let candidateId = preferredId;
  while (seenKeys.has(statefulBlockKey(blockType, candidateId))) {
    candidateId = generateBlockId();
  }
  seenKeys.add(statefulBlockKey(blockType, candidateId));
  return candidateId;
}

function cloneNodeWithNormalizedIds(
  node: BlocksDocumentNode,
  generateBlockId: () => string,
  state: BlocksDocumentNormalizationState,
): BlocksDocumentNode {
  const content = node.content?.map((child) => ({...child}));
  const attrs = {...node.attrs};
  const existingId = stringAttr(attrs.id);
  const id =
    existingId && !state.seenBlockIds.has(existingId)
      ? existingId
      : generateBlockId();
  state.seenBlockIds.add(id);
  attrs.id = id;

  if (node.type === 'blocksDocumentStatefulBlock') {
    const ownership = stringAttr(attrs.ownership) ?? 'owned';
    const blockType = stringAttr(attrs.blockType);
    const blockInstanceId = stringAttr(attrs.blockInstanceId) ?? id;
    const blockInstanceKey = statefulBlockKey(blockType, blockInstanceId);
    attrs.blockInstanceId =
      ownership === 'owned'
        ? uniqueOwnedStatefulBlockInstanceId(
            blockType,
            state.seenOwnedStatefulBlockKeys.has(blockInstanceKey)
              ? id
              : blockInstanceId,
            generateBlockId,
            state.seenOwnedStatefulBlockKeys,
          )
        : blockInstanceId;
  }

  return {
    ...node,
    attrs,
    ...(content ? {content} : {}),
  };
}

export function hasUnnormalizedBlocksDocumentIds(value: BlocksDocumentContent) {
  const seenBlockIds = new Set<string>();
  const seenOwnedStatefulBlockKeys = new Set<string>();
  for (const node of value.content) {
    const id = stringAttr(node.attrs?.id);
    if (!id || seenBlockIds.has(id)) return true;
    seenBlockIds.add(id);

    if (node.type !== 'blocksDocumentStatefulBlock') continue;
    const ownership = stringAttr(node.attrs?.ownership) ?? 'owned';
    if (ownership !== 'owned') continue;
    const blockType = stringAttr(node.attrs?.blockType);
    const blockInstanceId = stringAttr(node.attrs?.blockInstanceId) ?? id;
    const key = statefulBlockKey(blockType, blockInstanceId);
    if (seenOwnedStatefulBlockKeys.has(key)) return true;
    seenOwnedStatefulBlockKeys.add(key);
  }
  return false;
}

export function normalizeBlocksDocumentContent(
  value: BlocksDocumentContent,
  generateBlockId: () => string = defaultGenerateBlockId,
): BlocksDocumentContent {
  const state: BlocksDocumentNormalizationState = {
    seenBlockIds: new Set(),
    seenOwnedStatefulBlockKeys: new Set(),
  };
  return {
    ...value,
    type: 'doc',
    content: value.content.map((node) =>
      cloneNodeWithNormalizedIds(node, generateBlockId, state),
    ),
  };
}

export function createDefaultBlocksDocumentBlockId() {
  return defaultGenerateBlockId();
}
