/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  DocumentAsset,
  DocumentArtifact,
  type DocumentAsset as DocumentAssetType,
  DocumentsSliceConfig,
  type DocumentArtifact as DocumentArtifactType,
  type DocumentsSliceConfig as DocumentsSliceConfigType,
} from './DocumentsSliceConfig';
export {
  createDefaultDocumentsConfig,
  createDocumentsSlice,
  type CreateDocumentsSliceProps,
  type DocumentAssetInput,
  type DocumentsSliceState,
} from './DocumentsSlice';
export {
  createDocumentCommands,
  DOCUMENT_AI_INSTRUCTIONS,
} from './documentCommands';
export {
  MarkdownDocumentEditor,
  type MarkdownDocumentEditorMode,
  type MarkdownDocumentEditorProps,
} from './MarkdownDocumentEditor';
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
