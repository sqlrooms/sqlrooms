/**
 * {@include ../README.md}
 * @packageDocumentation
 */

// Tools
export {
  QueryToolResult,
  createQueryToolRenderer,
  type QueryToolRendererOptions,
} from './tools/query/QueryToolResult';
export {
  QueryToolParameters,
  createQueryTool,
  getQuerySummary,
  type QueryToolOutput,
  type QueryToolOptions,
} from './tools/query/queryTool';
export {
  createCommandTools,
  ExecuteCommandToolParameters,
  GetCommandToolParameters,
  ListCommandsToolParameters,
  SearchCommandsToolParameters,
} from './tools/commandTools';
export type {
  CommandToolDescriptor,
  CommandToolSearchDescriptor,
  CommandToolsOptions,
  DefaultCommandTools,
  ExecuteCommandToolLlmResult,
  ExecuteCommandToolParameters as ExecuteCommandToolParametersType,
  GetCommandToolLlmResult,
  GetCommandToolParameters as GetCommandToolParametersType,
  ListCommandsToolLlmResult,
  ListCommandsToolParameters as ListCommandsToolParametersType,
  SearchCommandsToolLlmResult,
  SearchCommandsToolParameters as SearchCommandsToolParametersType,
} from './tools/commandTools';
export {
  DEFAULT_SKILL_RUNTIME_TOOL_POLICY,
  createSkillRuntimeToolPolicy,
} from './tools/skillRuntimeToolPolicy';
export type {
  CreateSkillRuntimeToolPolicyOptions,
  SkillRuntimeCommandToolPolicy,
  SkillRuntimeToolPolicy,
} from './tools/skillRuntimeToolPolicy';
export {
  createDefaultAiTools,
  createDefaultAiToolRenderers,
} from './tools/defaultTools';
export type {
  DefaultToolsOptions,
  DefaultAiToolRenderers,
} from './tools/defaultTools';
export {
  createDefaultAiInstructions,
  formatTablesForLLM,
} from './tools/defaultInstructions';
export {
  DEFAULT_TABLE_SCHEMA_CONTEXT_LIMITS,
  formatOtherTableScopesForAi,
  formatTableSchemaForAi,
  formatTableSummaryForAi,
  getAiTableScopeSummary,
  getAiTableSchemaContextLimits,
  getTablesForAiScope,
} from './tools/tableSchemaContext';
export type {
  AiTableScope,
  AiTableScopeOptions,
  TableSchemaContextLimits,
} from './tools/tableSchemaContext';

// Skills
export {
  SkillError,
  SkillManifestError,
  SkillNotFoundError,
  SkillRootReadOnlyError,
  SkillConflictError,
} from './skills';
export type {SkillErrorCode, SkillErrorContext} from './skills';
export {
  SkillManifestSchema,
  parseSkillManifest,
  serializeSkillManifest,
  loadSkillFromFiles,
  CompositeSkillStorage,
} from './skills';
export type {SkillManifest} from './skills';
export type {
  SkillStorage,
  SkillRoot,
  SkillRef,
  SkillFile,
  SkillRecord,
  SkillListing,
  SkillWriteContent,
} from './skills';

// Skills - authoring
export {
  createSkillDraftStore,
  createSkillAuthoringAgent,
  SKILL_AUTHORING_TOOL_NAMES,
  createWriteManifestTool,
  createWriteInstructionsTool,
  createSaveSkillTool,
  buildSkillAuthoringSystemPrompt,
  containsForbidden,
  DEFAULT_SKILL_AUTHORING_STOP_STEPS,
  SkillDraftPreview,
  SkillAuthoringPanel,
  DefaultSkillAuthoringPanelHeader,
} from './skills';
export type {
  SkillAuthoringContext,
  SkillDraft,
  SkillDraftState,
  SkillDraftStatus,
  SkillDraftStore,
  SaveSkillCallback,
  CreateSkillAuthoringAgentOptions,
  SkillDraftPreviewProps,
  SkillAuthoringPanelProps,
} from './skills';

// From @sqlrooms/ai-core - State/Logic
export {createAiSlice, useStoreWithAi} from '@sqlrooms/ai-core';
export type {AiSliceState} from '@sqlrooms/ai-core';
export {useScrollToBottom} from '@sqlrooms/ai-core';
export {
  cleanGeneratedSessionTitle,
  generateSessionTitle,
  getSessionUserMessageText,
  isDefaultGeneratedSessionName,
  useGenerateSessionTitle,
} from '@sqlrooms/ai-core';
export type {
  GenerateSessionTitleArgs,
  GenerateSessionTitleOptions,
  GenerateSessionTitlePromptOptions,
  GenerateSessionTitleResult,
  UseGenerateSessionTitleOptions,
} from '@sqlrooms/ai-core';
export {AiThinkingDots} from '@sqlrooms/ai-core';
export {cleanupPendingAnalysisResults, ToolAbortError} from '@sqlrooms/ai-core';
export {fixIncompleteToolCalls} from '@sqlrooms/ai-core';
export {streamSubAgent, updateAgentToolCallData} from '@sqlrooms/ai-core';
export {
  getEffectiveSessionContextItemIds,
  getRunContextItemIds,
  getVisibleSessionContextItemIds,
  isChatSessionEmpty,
  isAnalysisSessionEmpty,
} from '@sqlrooms/ai-core';
export type {
  AddToolOutput,
  AiToolExecutionContext,
  AgentStreamOutput,
  AgentSnapshot,
  AgentToolCall,
  AgentToolCallAdditionalData,
  ToolRenderers,
  ToolRenderer,
  ToolRendererProps,
  ToolRendererRegistry,
  StoredTool,
  StoredToolSet,
  AiSliceOptions,
} from '@sqlrooms/ai-core';

// From @sqlrooms/ai-core - Components
export {ChatMessagesContainer} from '@sqlrooms/ai-core';
// @deprecated Use `Chat.Messages` instead.
export {AnalysisResultsContainer} from '@sqlrooms/ai-core';
export {ChatTurnView} from '@sqlrooms/ai-core';
export type {ChatTurnViewProps} from '@sqlrooms/ai-core';
/** @deprecated Use `ChatTurnView` instead. */
export {AnalysisResult} from '@sqlrooms/ai-core';
export {MessageContent, processMessageContent} from '@sqlrooms/ai-core';
export type {MessageContentProps} from '@sqlrooms/ai-core';
/** @deprecated Use `MessageContent` instead. */
export {AnalysisAnswer} from '@sqlrooms/ai-core';
/** @deprecated Use `processMessageContent` instead. */
export {processAnalysisAnswerContent} from '@sqlrooms/ai-core';
export {ErrorMessage} from '@sqlrooms/ai-core';
export type {ErrorMessageComponentProps} from '@sqlrooms/ai-core';
export {PromptSuggestions} from '@sqlrooms/ai-core';
export {ModelSelector} from '@sqlrooms/ai-core';
export {SessionControls} from '@sqlrooms/ai-core';
export {QueryControls} from '@sqlrooms/ai-core';
export {
  BlockAiPromptPopover,
  type BlockAiPromptPopoverProps,
  createAskAiBlockHeaderAction,
  type AskAiBlockHeaderActionRenderContext,
  type CreateAskAiBlockHeaderActionOptions,
} from '@sqlrooms/ai-core';
export {DeleteSessionDialog} from '@sqlrooms/ai-core';
export {SessionActions} from '@sqlrooms/ai-core';
export {SessionDropdown} from '@sqlrooms/ai-core';
export {SessionTitle} from '@sqlrooms/ai-core';
export type {SessionType} from '@sqlrooms/ai-core';
export {ToolErrorMessage} from '@sqlrooms/ai-core';
export {ToolCallInfo} from '@sqlrooms/ai-core';
export {ShowToolCallDetailsProvider} from '@sqlrooms/ai-core';
export type {
  ForkSessionFromMessageArgs,
  ToolRenderBehavior,
  ToolStructureBehavior,
  ToolDisplayBehavior,
  LocalAgentChatRootProps,
} from '@sqlrooms/ai-core';
export {Chat} from '@sqlrooms/ai-core';
export {ContextSelector, CHAT_CONTEXT_SELECTOR_SLOT} from '@sqlrooms/ai-core';
export {
  findChatSearchMatches,
  getAnalysisResultsFromUiMessages,
  getChatRequestErrorMessage,
  getChatTurnsFromUiMessages,
  markdownToPlainText,
  normalizeChatSearchQuery,
} from '@sqlrooms/ai-core';
export type {
  ChatMessageMetadata,
  ChatRequestErrorMessage,
  ChatSearchBlock,
  ChatSearchMatch,
  ChatTurn,
} from '@sqlrooms/ai-core';
export type {
  ContextSelectorItem,
  ContextSelectorRootProps,
} from '@sqlrooms/ai-core';

// From @sqlrooms/ai-config
export {
  AiRunContextItemSchema,
  AiRunContextSchema,
  AiSliceConfig,
  AiSessionForkOrigin,
  ChatSessionSchema,
  createBlockContextItem,
  BlockAiRunContextItemSchema,
  createDefaultAiConfig,
  AiSettingsSliceConfig,
  AnalysisSessionSchema,
  AnalysisResultSchema,
  ErrorMessageSchema,
  getAiRunContextPrimaryItem,
  getAiRunContextItems,
  setAiRunContextPrimaryItem,
} from '@sqlrooms/ai-config';
export type {
  AiRunContext,
  AiRunContextItem,
  BlockAiRunContextItem,
} from '@sqlrooms/ai-config';
export type {ToolUIPart, UIMessagePart} from '@sqlrooms/ai-config';

// From @sqlrooms/ai-settings - State/Logic
export {
  createAiSettingsSlice,
  useStoreWithAiSettings,
} from '@sqlrooms/ai-settings';
export type {AiSettingsSliceState} from '@sqlrooms/ai-settings';
export {createDefaultAiSettingsConfig} from '@sqlrooms/ai-settings';

// From @sqlrooms/ai-settings - Components
export {AiSettingsPanel} from '@sqlrooms/ai-settings';
export {AiProvidersSettings} from '@sqlrooms/ai-settings';
export {AiModelsSettings} from '@sqlrooms/ai-settings';
export {AiModelParameters} from '@sqlrooms/ai-settings';
export {AiModelUsage} from '@sqlrooms/ai-settings';
export type {ModelUsageData} from '@sqlrooms/ai-settings';
