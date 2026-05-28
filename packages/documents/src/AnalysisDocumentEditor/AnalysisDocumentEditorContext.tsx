import type {Editor} from '@tiptap/react';
import {createContext, useContext} from 'react';
import type {
  AnalysisDocumentContent,
  AnalysisDocumentNode,
} from '../AnalysisDocumentSliceConfig';
import type {DocumentAsset} from '../DocumentsSliceConfig';

export type AnalysisDocumentEditorContextValue = {
  editor: Editor | null;
  analysisId: string;
  value: AnalysisDocumentContent;
  assets: Record<string, DocumentAsset>;
  onChange: (value: AnalysisDocumentContent) => void;
  readOnly: boolean;
  generateBlockId: () => string;
};

export const AnalysisDocumentEditorContext =
  createContext<AnalysisDocumentEditorContextValue | null>(null);

export function useAnalysisDocumentEditorContext() {
  const context = useContext(AnalysisDocumentEditorContext);
  if (!context) {
    throw new Error(
      'AnalysisDocumentEditor compound components must be used within AnalysisDocumentEditor.Root',
    );
  }
  return context;
}

function defaultGenerateBlockId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (randomUUID) {
    return randomUUID.call(globalThis.crypto);
  }
  return `analysis-block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const blockTypesWithIds = new Set([
  'heading',
  'paragraph',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'bulletList',
  'orderedList',
  'taskList',
  'analysisRichText',
  'analysisImage',
  'analysisChartImage',
  'analysisChart',
  'analysisArtifactEmbed',
]);

function cloneNodeWithId(
  node: AnalysisDocumentNode,
  generateBlockId: () => string,
): AnalysisDocumentNode {
  const content = node.content?.map((child) => ({...child}));
  const id = node.attrs?.id;
  if (!blockTypesWithIds.has(node.type) || typeof id === 'string') {
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

export function normalizeAnalysisDocumentContent(
  value: AnalysisDocumentContent,
  generateBlockId: () => string = defaultGenerateBlockId,
): AnalysisDocumentContent {
  return {
    ...value,
    type: 'doc',
    content: value.content.map((node) =>
      cloneNodeWithId(node, generateBlockId),
    ),
  };
}

export function createDefaultAnalysisBlockId() {
  return defaultGenerateBlockId();
}
