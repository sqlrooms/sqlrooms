/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  DocumentAsset,
  type DocumentAsset as DocumentAssetType,
  DocumentsSliceConfig,
  type DocumentsSliceConfig as DocumentsSliceConfigType,
  MarkdownDocumentState,
  type MarkdownDocumentState as MarkdownDocumentStateType,
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
  BlockDocumentStatefulBlockBlock,
  BlockDocumentTodoBlock,
  blockDocumentBlockToNode,
  blockDocumentContentToBlocks,
  blockDocumentNodeId,
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
  type BlockDocumentOwnedStatefulBlockReference,
  type BlockDocumentMutationMetadata,
  type BlockDocumentMutationOrigin,
  type BlockDocumentStatefulBlockReference,
  type BlockDocumentSyncMetadata,
  type BlockDocumentsSliceState,
  type CreateBlockDocumentsSliceProps,
} from './BlockDocumentsSlice';
export {
  createBlockDocumentFeatureSlices,
  type BlockDocumentFeatureSlicesState,
} from './BlockDocumentFeatureSlices';
export {
  BlockDocumentChartRendererProvider,
  useBlockDocumentChartRenderBlockHeaderActions,
  useBlockDocumentChartSettings,
  useBlockDocumentChartRenderer,
  type BlockDocumentChartRenderer,
  type BlockDocumentChartRendererProps,
  type BlockDocumentChartRendererProviderProps,
} from './BlockDocumentChartRendererContext';
export {
  type BlockDocumentBlockHeaderActionsRenderContext,
  type BlockDocumentBlockHeaderActionsRenderer,
  type BlockDocumentBlockHeaderActionsRenderer as BlockDocumentChartHeaderActionsRenderer,
  type BlockDocumentBlockHeaderActionsRenderer as BlockDocumentStatefulBlockHeaderActionsRenderer,
} from './BlockDocumentBlockHeaderActions';
export {
  BlockDocumentStatefulBlockRendererProvider,
  useBlockDocumentRenderBlockHeaderActions,
  useBlockDocumentStatefulBlockRenderer,
  useBlockDocumentStatefulBlockSettings,
  useBlockDocumentStatefulBlockTypes,
  type BlockDocumentStatefulBlockCreateNodeOptions,
  type BlockDocumentStatefulBlockRenderer,
  type BlockDocumentStatefulBlockRendererProps,
  type BlockDocumentStatefulBlockRendererProviderProps,
  type BlockDocumentStatefulBlockRenderers,
  type BlockDocumentStatefulBlockType,
} from './BlockDocumentStatefulBlockRendererContext';
export {
  blockContextItemId,
  defaultBlockTitle,
  parseBlockContextItemId,
  type BlockAiTarget,
} from './BlockAiTarget';
export {
  createDefaultDocumentsConfig,
  createDocumentsSlice,
  type CreateDocumentsSliceProps,
  type DocumentAssetInput,
  type DocumentsSliceState,
} from './DocumentsSlice';
export {createDocumentCommands} from './documentCommands';
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
  BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID,
  BLOCK_DOCUMENT_AGENT_ACTOR,
  BLOCK_DOCUMENT_MOVE_BLOCK_COMMAND_ID,
  createBlockDocumentCommandAiAdapter,
  type CreateBlockDocumentCommandAiAdapterOptions,
} from './createBlockDocumentCommandAiAdapter';
export {
  BLOCK_DOCUMENT_AGENT_TOOL_NAME,
  KnownDocumentBlockTools,
  type BlockDocumentAiAdapter,
  type BlockDocumentAgentPlanStep,
  type BlockDocumentAgentResult,
  type BlockDocumentBlockSummary,
  type BlockDocumentMoveBlockAiAdapter,
  type ExtraBlockDocumentAiToolsFactory,
  type ExtraBlockDocumentAiToolsParams,
} from './BlockDocumentAi';
export {
  createAddBlockDocumentTextBlockTool,
  createBlockDocumentTextBlock,
  type CreateAddBlockDocumentTextBlockToolOptions,
} from './createAddBlockDocumentTextBlockTool';
export {
  createListBlockDocumentBlocksTool,
  type BlockDocumentBlockSummaryAugmenter,
  type CreateListBlockDocumentBlocksToolOptions,
} from './createListBlockDocumentBlocksTool';
export {
  createMoveBlockDocumentBlockTool,
  type CreateMoveBlockDocumentBlockToolOptions,
} from './createMoveBlockDocumentBlockTool';
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
export {
  BlockDocumentArtifact,
  type BlockDocumentArtifactProps,
} from './BlockDocumentArtifact';
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
export * from './block-settings';
export type {Editor} from '@tiptap/react';
