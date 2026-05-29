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
  BlocksDocumentArtifactEmbedBlock,
  BlocksDocumentBlock,
  BlocksDocumentChartBlock,
  BlocksDocumentChartImageBlock,
  BlocksDocument,
  BlocksDocumentContent,
  BlocksDocumentMark,
  BlocksDocumentNode,
  BlocksDocumentsSliceConfig,
  BlocksDocumentHeadingBlock,
  BlocksDocumentImageBlock,
  BlocksDocumentListBlock,
  BlocksDocumentParagraphBlock,
  BlocksDocumentRichTextBlock,
  BlocksDocumentTodoBlock,
  blocksDocumentBlockToNode,
  blocksDocumentContentToBlocks,
  blocksDocumentNodeToBlock,
  createEmptyBlocksDocumentContent,
  type BlocksDocumentBlock as BlocksDocumentBlockType,
  type BlocksDocument as BlocksDocumentType,
  type BlocksDocumentContent as BlocksDocumentContentType,
  type BlocksDocumentMark as BlocksDocumentMarkType,
  type BlocksDocumentNode as BlocksDocumentNodeType,
  type BlocksDocumentsSliceConfig as BlocksDocumentsSliceConfigType,
} from './BlocksDocumentSliceConfig';
export {
  createBlocksDocumentsSlice,
  createDefaultBlocksDocumentsConfig,
  type BlocksDocumentMutationMetadata,
  type BlocksDocumentMutationOrigin,
  type BlocksDocumentSyncMetadata,
  type BlocksDocumentsSliceState,
  type CreateBlocksDocumentsSliceProps,
} from './BlocksDocumentsSlice';
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
export {BlocksDocumentEditor} from './BlocksDocumentEditor';
export {
  BlocksDocumentEditorRoot,
  type BlocksDocumentEditorRootProps,
} from './BlocksDocumentEditor/BlocksDocumentEditorRoot';
export {
  BlocksDocumentEditorContent,
  type BlocksDocumentEditorContentProps,
} from './BlocksDocumentEditor/BlocksDocumentEditorContent';
export {
  BlocksDocumentToolbar,
  type BlocksDocumentToolbarProps,
} from './BlocksDocumentEditor/BlocksDocumentToolbar';
export {
  createDefaultBlocksDocumentBlockId,
  normalizeBlocksDocumentContent,
  useBlocksDocumentEditorContext,
  type BlocksDocumentEditorContextValue,
} from './BlocksDocumentEditor/BlocksDocumentEditorContext';
export {BlocksDocumentArtifact} from './BlocksDocumentArtifact';
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
export {useStoreWithBlocksDocuments} from './useStoreWithBlocksDocuments';
export {useStoreWithDocuments} from './useStoreWithDocuments';
export {
  buildKnowledgeIndex,
  type BuildKnowledgeIndexProps,
  type DocumentLink,
  type DocumentTag,
  type KnowledgeIndex,
  type UnresolvedDocumentLink,
} from './knowledgeIndex';
