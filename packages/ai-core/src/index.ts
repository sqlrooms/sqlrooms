/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {createAiSlice, useStoreWithAi} from './AiSlice';

export type {
  AiSliceState,
  AiSliceOptions,
  ForkSessionFromMessageArgs,
} from './AiSlice';
export type {AiTimeoutOptions} from './timeouts';
export {
  measureProviderContext,
  tryMeasureProviderContext,
} from './devtools/providerContextDiagnostics';
export type {MeasureProviderContextArgs} from './devtools/providerContextDiagnostics';
export type {ProviderContextDiagnostic} from './types';
export {
  ChatActiveStatus,
  getChatActiveStatus,
} from './components/ChatActiveStatus';
export {ChatMessagesContainer} from './components/ChatMessagesContainer';
/** @deprecated Use `Chat.Messages` instead. */
export {ChatMessagesContainer as AnalysisResultsContainer} from './components/ChatMessagesContainer';
export {ChatTurnView} from './components/ChatTurnView';
export type {ChatTurnViewProps} from './components/ChatTurnView';
/** @deprecated Use `ChatTurnView` instead. */
export {ChatTurnView as AnalysisResult} from './components/ChatTurnView';
export {
  MessageContent,
  processMessageContent,
} from './components/MessageContent';
export type {MessageContentProps} from './components/MessageContent';
/** @deprecated Use `MessageContent` instead. */
export {MessageContent as AnalysisAnswer} from './components/MessageContent';
/** @deprecated Use `processMessageContent` instead. */
export {processMessageContent as processAnalysisAnswerContent} from './components/MessageContent';
export {ErrorMessage} from './components/ErrorMessage';
export {useScrollToBottom} from './hooks/useScrollToBottom';
export {useSessionChat} from './hooks/useSessionChat';
export {useElapsedTime} from './hooks/useElapsedTime';
export {
  cleanGeneratedSessionTitle,
  generateSessionTitle,
  getSessionUserMessageText,
  isDefaultGeneratedSessionName,
  useGenerateSessionTitle,
} from './hooks/useGenerateSessionTitle';
export type {
  GenerateSessionTitleArgs,
  GenerateSessionTitleOptions,
  GenerateSessionTitlePromptOptions,
  GenerateSessionTitleResult,
  UseGenerateSessionTitleOptions,
} from './hooks/useGenerateSessionTitle';
export {Chat, type LocalAgentChatRootProps} from './components/Chat';
export {
  ChatRendering,
  useChatRendering,
  useChatRenderingComponents,
  useChatNestedActivityMode,
  mergeChatRenderingComponents,
} from './components/ChatRenderingContext';
export type {
  ChatActiveStatusInfo,
  ChatActiveStatusProps,
  ChatComponentType,
  ChatRenderingProps,
  ChatRenderingComponents,
  ChatRenderingValue,
  ChatNestedActivityMode,
  ChatTurnSlotProps,
  ChatTurnPresentation,
  ChatPromptRegion,
  ChatActivityRegion,
  ChatActivityItem,
  ChatTextRegion,
  ChatTextItem,
  ChatOutputRegion,
  ChatOutputItem,
  ChatCopyAction,
  ChatForkAction,
  ChatErrorRegion,
  ChatActionsRegion,
  ChatTimelineRegion,
  ChatToolState,
  ChatPromptProps,
  ChatActivityProps,
  ChatReasoningProps,
  ChatTextOutputProps,
  ChatToolActivityProps,
  ChatHoistedOutputProps,
  ChatErrorProps,
  ChatActionsProps,
} from './components/ChatRenderingContext';
export {
  DefaultChatTurn,
  DefaultChatPrompt,
  DefaultChatActivity,
  DefaultChatReasoning,
  DefaultChatTextOutput,
  DefaultChatToolActivity,
  DefaultChatHoistedOutput,
  DefaultChatError,
  DefaultChatActions,
  defaultChatRenderingComponents,
} from './components/defaultChatRendering';
export {
  LocalAgentChatRuntimeProvider,
  SessionChatRuntimeProvider,
} from './components/ChatRuntimeContext';
export {
  useChatComposer,
  Input as ChatComposerInput,
  Send as ChatComposerSend,
  Stop as ChatComposerStop,
  DropTarget as ChatComposerDropTarget,
} from './components/composer';
export type {
  ChatComposerMode,
  ChatComposerState,
  ChatComposerInputProps,
  ChatComposerSendProps,
  ChatComposerStopProps,
  ChatComposerDropTargetProps,
} from './components/composer';
export {
  usePromptSuggestions,
  Root as ChatSuggestionsRoot,
  Item as ChatSuggestionsItem,
  VisibilityToggle as ChatSuggestionsVisibilityToggle,
  Dismiss as ChatSuggestionsDismiss,
} from './components/suggestions';
export type {
  ChatSuggestionsState,
  ChatSuggestionsRootProps,
  ChatSuggestionsItemProps,
  ChatSuggestionsVisibilityToggleProps,
  ChatSuggestionsDismissProps,
} from './components/suggestions';
export {
  getAnalysisResultsFromUiMessages,
  getChatRequestErrorMessage,
  getChatTurnsFromUiMessages,
} from './chatTurns';
export type {
  ChatMessageMetadata,
  ChatRequestErrorMessage,
  ChatTurn,
} from './chatTurns';
export {ContextSelector} from './components/context/ContextSelector';
export {
  toggleContextSelectorItem,
  promoteContextSelectorItem,
  reorderContextSelectorItems,
} from './components/context/utils';
export {CHAT_CONTEXT_SELECTOR_SLOT} from './components/context/types';
export type {
  ContextSelectorItem,
  ContextSelectorRootProps,
} from './components/context/types';

export {PromptSuggestions} from './components/PromptSuggestions';
export {ModelSelector} from './components/ModelSelector';
export {SessionControls} from './components/SessionControls';
export {QueryControls} from './components/QueryControls';
export {
  BlockAiPromptPopover,
  type BlockAiPromptPopoverProps,
} from './components/BlockAiPromptPopover';
export {
  createAskAiBlockHeaderAction,
  type AskAiBlockHeaderActionRenderContext,
  type CreateAskAiBlockHeaderActionOptions,
} from './components/createAskAiBlockHeaderAction';
export {DeleteSessionDialog} from './components/session/DeleteSessionDialog';
export {SessionActions} from './components/session/SessionActions';
export {SessionDropdown} from './components/session/SessionDropdown';
export {SessionTitle} from './components/session/SessionTitle';
export type {SessionType} from './components/session/SessionType';
export {ToolErrorMessage} from './components/tools/ToolErrorMessage';
export type {ErrorMessageComponentProps} from './components/ErrorMessage';
export {ToolCallInfo} from './components/ToolCallInfo';

export {
  AiRunContextItemSchema,
  AiRunContextSchema,
  AiSliceConfig,
  AiSessionForkOrigin,
  AnalysisSessionSchema,
  BlockAiRunContextItemSchema,
  ChatSessionSchema,
  createBlockContextItem,
  createDefaultAiConfig,
  getAiRunContextPrimaryItem,
  getAiRunContextItems,
  setAiRunContextPrimaryItem,
} from '@sqlrooms/ai-config';
export type {
  AiRunContext,
  AiRunContextItem,
  BlockAiRunContextItem,
} from '@sqlrooms/ai-config';
export {
  getEffectiveSessionContextItemIds,
  getRunContextItemIds,
  getVisibleSessionContextItemIds,
  isChatSessionEmpty,
  isAnalysisSessionEmpty,
} from './contextSelection';
export {AiThinkingDots} from './components/AiThinkingDots';
export {
  cleanupPendingAnalysisResults,
  ToolAbortError,
  extractModelsFromSettings,
  shouldEndAnalysis,
} from './utils';
export type {
  AddToolApprovalResponse,
  AddToolOutput,
  AiToolExecutionContext,
  AgentProgressSnapshot,
  AgentSnapshot,
  StoredTool,
  StoredToolSet,
  ToolRendererProps,
  ToolRenderer,
  ToolRendererShouldHoist,
  ToolRendererRegistry,
  ToolRenderers,
  ToolTimingEntry,
  AssistantMessageMetadata,
  MessageTokenUsage,
} from './types';
export {fixIncompleteToolCalls} from './utils';

export {withRunContextTools} from './chatTransport';

export {
  streamSubAgent,
  updateAgentToolCallData,
  formatAbortSnapshot,
} from './agents/AgentUtils';
export type {
  AgentStreamOutput,
  AgentToolCall,
  AgentToolCallAdditionalData,
  PendingSubAgentApproval,
} from './types';
export {ExpandableContent} from './components/ExpandableContent';
export {ActivityBox} from './components/ActivityBox';
export type {ActivityBoxProps} from './components/ActivityBox';
export {
  FlatAgentRenderer,
  HoistedToolCallRenderer,
  OrchestratorToolLogLine,
  ShowToolCallDetailsProvider,
} from './components/FlatAgentRenderer';
export type {
  ToolRenderBehavior,
  ToolStructureBehavior,
  ToolDisplayBehavior,
} from './components/FlatAgentRenderer';
export {
  collectHoistableRenderers,
  toolRendererAllowsHoist,
} from './components/collectHoistableRenderers';
export type {HoistableToolCall} from './components/collectHoistableRenderers';
export {
  buildChatTurnModel,
  splitTextAroundHoists,
  computeComputationTimeMs,
  getToolName,
  isAgentToolPart,
} from './components/buildChatTurnModel';
export type {
  ChatTurnModel,
  ChatTurnActivityItem,
  ChatTurnTextItem,
  ChatTurnSegment,
  ToolPartWithId,
} from './components/buildChatTurnModel';
/** @deprecated Prefer {@link buildChatTurnModel}. Chronological presentation adapter. */
export {buildChatTurnRenderPlan} from './components/buildChatTurnRenderPlan';
export type {ChatTurnRenderPlan} from './components/buildChatTurnRenderPlan';
export {ContextUsageIndicator} from './components/ContextUsageIndicator';
export {
  HoistedRenderersProvider,
  useHoistedRenderers,
} from './components/HoistedRenderersContext';
export {
  findChatSearchMatches,
  markdownToPlainText,
  normalizeChatSearchQuery,
} from './components/ChatSearch';
export type {ChatSearchBlock, ChatSearchMatch} from './components/ChatSearch';
