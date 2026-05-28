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
  AnalysisArtifactEmbedBlock,
  AnalysisBlock,
  AnalysisChartBlock,
  AnalysisChartImageBlock,
  AnalysisDocument,
  AnalysisDocumentContent,
  AnalysisDocumentMark,
  AnalysisDocumentNode,
  AnalysisDocumentsSliceConfig,
  AnalysisHeadingBlock,
  AnalysisImageBlock,
  AnalysisListBlock,
  AnalysisParagraphBlock,
  AnalysisRichTextBlock,
  AnalysisTodoBlock,
  analysisBlockToNode,
  analysisContentToBlocks,
  analysisNodeToBlock,
  createEmptyAnalysisDocumentContent,
  type AnalysisBlock as AnalysisBlockType,
  type AnalysisDocument as AnalysisDocumentType,
  type AnalysisDocumentContent as AnalysisDocumentContentType,
  type AnalysisDocumentMark as AnalysisDocumentMarkType,
  type AnalysisDocumentNode as AnalysisDocumentNodeType,
  type AnalysisDocumentsSliceConfig as AnalysisDocumentsSliceConfigType,
} from './AnalysisDocumentSliceConfig';
export {
  createAnalysisDocumentsSlice,
  createDefaultAnalysisDocumentsConfig,
  type AnalysisDocumentMutationMetadata,
  type AnalysisDocumentMutationOrigin,
  type AnalysisDocumentSyncMetadata,
  type AnalysisDocumentsSliceState,
  type CreateAnalysisDocumentsSliceProps,
} from './AnalysisDocumentsSlice';
export {
  AnalysisChartRendererProvider,
  useAnalysisChartRenderer,
  type AnalysisChartRenderer,
  type AnalysisChartRendererProps,
  type AnalysisChartRendererProviderProps,
} from './AnalysisChartRendererContext';
export {
  AnalysisEmbedRendererProvider,
  useAnalysisArtifactEmbedRenderer,
  useAnalysisArtifactEmbedTypes,
  type AnalysisArtifactEmbedType,
  type AnalysisArtifactEmbedRenderer,
  type AnalysisArtifactEmbedRendererProps,
  type AnalysisArtifactEmbedRenderers,
  type AnalysisEmbedRendererProviderProps,
} from './AnalysisEmbedRendererContext';
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
  ANALYSIS_AI_INSTRUCTIONS,
  createAnalysisCommands,
} from './analysisCommands';
export {
  ANALYSIS_AGENT_COMMAND_IDS,
  ANALYSIS_AGENT_TOOL_NAME,
  createAnalysisAuthoringInstructions,
  type AnalysisAgentCommandId,
  type AnalysisAgentPlanStep,
  type AnalysisAgentResult,
  type CreateAnalysisAuthoringInstructionsOptions,
} from './analysisAi';
export {AnalysisDocumentEditor} from './AnalysisDocumentEditor';
export {
  AnalysisDocumentEditorRoot,
  type AnalysisDocumentEditorRootProps,
} from './AnalysisDocumentEditor/AnalysisDocumentEditorRoot';
export {
  AnalysisDocumentEditorContent,
  type AnalysisDocumentEditorContentProps,
} from './AnalysisDocumentEditor/AnalysisDocumentEditorContent';
export {
  AnalysisDocumentToolbar,
  type AnalysisDocumentToolbarProps,
} from './AnalysisDocumentEditor/AnalysisDocumentToolbar';
export {
  createDefaultAnalysisBlockId,
  normalizeAnalysisDocumentContent,
  useAnalysisDocumentEditorContext,
  type AnalysisDocumentEditorContextValue,
} from './AnalysisDocumentEditor/AnalysisDocumentEditorContext';
export {AnalysisDocumentArtifact} from './AnalysisDocument';
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
export {useStoreWithAnalysisDocuments} from './useStoreWithAnalysisDocuments';
export {useStoreWithDocuments} from './useStoreWithDocuments';
export {
  buildKnowledgeIndex,
  type BuildKnowledgeIndexProps,
  type DocumentLink,
  type DocumentTag,
  type KnowledgeIndex,
  type UnresolvedDocumentLink,
} from './knowledgeIndex';
