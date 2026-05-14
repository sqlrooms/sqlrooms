/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  DocumentArtifact,
  DocumentsSliceConfig,
  type DocumentArtifact as DocumentArtifactType,
  type DocumentsSliceConfig as DocumentsSliceConfigType,
} from './DocumentsSliceConfig';
export {
  createDefaultDocumentsConfig,
  createDocumentsSlice,
  type CreateDocumentsSliceProps,
  type DocumentsSliceState,
} from './DocumentsSlice';
export {
  createDocumentCommands,
  DOCUMENT_AI_INSTRUCTIONS,
} from './documentCommands';
export {MarkdownDocumentEditor} from './MarkdownDocumentEditor';
export {
  MarkdownDocumentEditorRoot,
  type MarkdownDocumentEditorRootProps,
  type MarkdownDocumentEditorMode,
} from './MarkdownDocumentEditor/MarkdownDocumentEditorRoot';
export {
  MarkdownDocumentEditorToolbar,
  type MarkdownDocumentEditorToolbarProps,
} from './MarkdownDocumentEditor/MarkdownDocumentEditorToolbar';
export {
  MarkdownDocumentEditorContent,
  type MarkdownDocumentEditorContentProps,
} from './MarkdownDocumentEditor/MarkdownDocumentEditorContent';
export {MarkdownDocument} from './MarkdownDocument';
export {useStoreWithDocuments} from './useStoreWithDocuments';
export {
  buildKnowledgeIndex,
  type BuildKnowledgeIndexProps,
  type DocumentLink,
  type DocumentTag,
  type KnowledgeIndex,
  type UnresolvedDocumentLink,
} from './knowledgeIndex';
