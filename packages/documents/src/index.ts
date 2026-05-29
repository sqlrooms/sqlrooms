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
  BlockDocumentBlock,
  BlockDocumentChartBlock,
  BlockDocumentChartImageBlock,
  BlockDocument,
  BlockDocumentContent,
  BlockDocumentMark,
  BlockDocumentNode,
  BlockDocumentsSliceConfig,
  BlockDocumentHeadingBlock,
  BlockDocumentImageBlock,
  BlockDocumentListBlock,
  BlockDocumentParagraphBlock,
  BlockDocumentRichTextBlock,
  BlockDocumentStatefulBlockBlock,
  BlockDocumentTodoBlock,
  blockDocumentBlockToNode,
  blockDocumentContentToBlocks,
  blockDocumentNodeToBlock,
  createEmptyBlockDocumentContent,
  type BlockDocumentBlock as BlockDocumentBlockType,
  type BlockDocument as BlockDocumentType,
  type BlockDocumentContent as BlockDocumentContentType,
  type BlockDocumentMark as BlockDocumentMarkType,
  type BlockDocumentNode as BlockDocumentNodeType,
  type BlockDocumentsSliceConfig as BlockDocumentsSliceConfigType,
} from './BlockDocumentSliceConfig';
export {
  createBlockDocumentsSlice,
  createDefaultBlockDocumentsConfig,
  type BlockDocumentOwnedStatefulBlockCreateContext,
  type BlockDocumentOwnedStatefulBlockDeleteContext,
  type BlockDocumentOwnedStatefulBlockRenameContext,
  type BlockDocumentOwnedStatefulBlockReference,
  type BlockDocumentMutationMetadata,
  type BlockDocumentMutationOrigin,
  type BlockDocumentStatefulBlockReference,
  type BlockDocumentSyncMetadata,
  type BlockDocumentsSliceState,
  type CreateBlockDocumentsSliceProps,
} from './BlockDocumentsSlice';
export {
  BlockDocumentChartRendererProvider,
  useBlockDocumentChartRenderer,
  type BlockDocumentChartRenderer,
  type BlockDocumentChartRendererProps,
  type BlockDocumentChartRendererProviderProps,
} from './BlockDocumentChartRendererContext';
export {
  BlockDocumentStatefulBlockRendererProvider,
  useBlockDocumentStatefulBlockRenderer,
  useBlockDocumentStatefulBlockTypes,
  type BlockDocumentStatefulBlockRenderer,
  type BlockDocumentStatefulBlockRendererProps,
  type BlockDocumentStatefulBlockRendererProviderProps,
  type BlockDocumentStatefulBlockRenderers,
  type BlockDocumentStatefulBlockType,
} from './BlockDocumentStatefulBlockRendererContext';
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
  BLOCK_DOCUMENT_COMMAND_SUFFIXES,
  createBlockDocumentCommandIds,
  createBlockDocumentCommands,
  type BlockDocumentStatefulBlockCommandContext,
  type BlockDocumentStatefulBlockCommandType,
  type BlockDocumentCommandSuffix,
  type CreateBlockDocumentCommandsOptions,
} from './BlockDocumentCommands';
export {
  BLOCK_DOCUMENT_AGENT_TOOL_NAME,
  createBlockDocumentAiInstructions,
  createBlockDocumentAuthoringInstructions,
  type BlockDocumentAgentPlanStep,
  type BlockDocumentAgentResult,
  type CreateBlockDocumentAuthoringInstructionsOptions,
} from './BlockDocumentAi';
export {BlockDocumentEditor} from './BlockDocumentEditor';
export {
  BlockDocumentEditorRoot,
  type BlockDocumentEditorRootProps,
} from './BlockDocumentEditor/BlockDocumentEditorRoot';
export {
  BlockDocumentEditorContent,
  type BlockDocumentEditorContentProps,
} from './BlockDocumentEditor/BlockDocumentEditorContent';
export {
  BlockDocumentToolbar,
  type BlockDocumentToolbarProps,
} from './BlockDocumentEditor/BlockDocumentToolbar';
export {
  createDefaultBlockDocumentBlockId,
  normalizeBlockDocumentContent,
  useBlockDocumentEditorContext,
  type BlockDocumentEditorContextValue,
} from './BlockDocumentEditor/BlockDocumentEditorContext';
export {BlockDocumentArtifact} from './BlockDocumentArtifact';
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
export {
  createMarkdownDocumentBlockDefinition,
  type CreateMarkdownDocumentBlockDefinitionOptions,
  type MarkdownDocumentBlockRenderProps,
} from './MarkdownDocumentBlock';
export {useStoreWithBlockDocuments} from './useStoreWithBlockDocuments';
export {useStoreWithDocuments} from './useStoreWithDocuments';
export {
  buildKnowledgeIndex,
  type BuildKnowledgeIndexProps,
  type DocumentLink,
  type DocumentTag,
  type KnowledgeIndex,
  type UnresolvedDocumentLink,
} from './knowledgeIndex';
