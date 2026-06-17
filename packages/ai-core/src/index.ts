/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {createAiSlice, useStoreWithAi} from './AiSlice';
export {wrapModelWithSqlroomsAiDevtools} from './devtools';

export type {
  AiSliceState,
  AiSliceOptions,
  ForkSessionFromMessageArgs,
} from './AiSlice';
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
  ChatSessionSchema,
  createDefaultAiConfig,
  getAiRunContextPrimaryItem,
  getAiRunContextItems,
  setAiRunContextPrimaryItem,
} from '@sqlrooms/ai-config';
export type {AiRunContext, AiRunContextItem} from '@sqlrooms/ai-config';
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
  StoredTool,
  StoredToolSet,
  ToolRendererProps,
  ToolRenderer,
  ToolRendererRegistry,
  ToolRenderers,
  ToolTimingEntry,
  AssistantMessageMetadata,
  MessageTokenUsage,
} from './types';
export {fixIncompleteToolCalls} from './utils';

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
export {
  FlatAgentRenderer,
  OrchestratorToolLogLine,
  ShowToolCallDetailsProvider,
} from './components/FlatAgentRenderer';
export type {
  ToolRenderBehavior,
  ToolStructureBehavior,
  ToolDisplayBehavior,
} from './components/FlatAgentRenderer';
export {collectHoistableRenderers} from './components/collectHoistableRenderers';
export type {HoistableToolCall} from './components/collectHoistableRenderers';
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
