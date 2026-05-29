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

function cloneNodeWithId(
  node: BlocksDocumentNode,
  generateBlockId: () => string,
): BlocksDocumentNode {
  const content = node.content?.map((child) => ({...child}));
  const id = node.attrs?.id;
  if (typeof id === 'string') {
    return content ? {...node, content} : {...node};
  }
  return {
    ...node,
    attrs: {
      ...node.attrs,
      id: generateBlockId(),
    },
    ...(content ? {content} : {}),
  };
}

export function normalizeBlocksDocumentContent(
  value: BlocksDocumentContent,
  generateBlockId: () => string = defaultGenerateBlockId,
): BlocksDocumentContent {
  return {
    ...value,
    type: 'doc',
    content: value.content.map((node) =>
      cloneNodeWithId(node, generateBlockId),
    ),
  };
}

export function createDefaultBlocksDocumentBlockId() {
  return defaultGenerateBlockId();
}
