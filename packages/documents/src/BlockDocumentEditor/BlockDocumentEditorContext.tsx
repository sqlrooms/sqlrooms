import type {Editor} from '@tiptap/react';
import {createContext, useContext} from 'react';
import type {
  BlockDocumentContent,
  BlockDocumentNode,
} from '../BlockDocumentSliceConfig';
import type {BlockDocumentMutationMetadata} from '../BlockDocumentsSlice';
import type {DocumentAsset} from '../DocumentsSliceConfig';

export type BlockDocumentEditorChangeHandler = (
  value: BlockDocumentContent,
  metadata?: BlockDocumentMutationMetadata,
) => void;

export type BlockDocumentEditorContextValue = {
  editor: Editor | null;
  documentId: string;
  value: BlockDocumentContent;
  assets: Record<string, DocumentAsset>;
  onChange: BlockDocumentEditorChangeHandler;
  readOnly: boolean;
  generateBlockId: () => string;
};

export const BlockDocumentEditorContext =
  createContext<BlockDocumentEditorContextValue | null>(null);

export function useBlockDocumentEditorContext() {
  const context = useContext(BlockDocumentEditorContext);
  if (!context) {
    throw new Error(
      'BlockDocumentEditor compound components must be used within BlockDocumentEditor.Root',
    );
  }
  return context;
}

function defaultGenerateBlockId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) {
    return randomUUID.call(globalThis.crypto);
  }
  return `block-document-block-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function stringAttr(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

type BlockDocumentNormalizationState = {
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
  node: BlockDocumentNode,
  generateBlockId: () => string,
  state: BlockDocumentNormalizationState,
): BlockDocumentNode {
  const content = node.content?.map((child) => ({...child}));
  const attrs = {...node.attrs};
  const existingId = stringAttr(attrs.id);
  const id =
    existingId && !state.seenBlockIds.has(existingId)
      ? existingId
      : generateBlockId();
  state.seenBlockIds.add(id);
  attrs.id = id;

  if (node.type === 'blockDocumentStatefulBlock') {
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

export function hasUnnormalizedBlockDocumentIds(value: BlockDocumentContent) {
  const seenBlockIds = new Set<string>();
  const seenOwnedStatefulBlockKeys = new Set<string>();
  for (const node of value.content) {
    const id = stringAttr(node.attrs?.id);
    if (!id || seenBlockIds.has(id)) return true;
    seenBlockIds.add(id);

    if (node.type !== 'blockDocumentStatefulBlock') continue;
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

export function normalizeBlockDocumentContent(
  value: BlockDocumentContent,
  generateBlockId: () => string = defaultGenerateBlockId,
): BlockDocumentContent {
  const state: BlockDocumentNormalizationState = {
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

export function createDefaultBlockDocumentBlockId() {
  return defaultGenerateBlockId();
}
