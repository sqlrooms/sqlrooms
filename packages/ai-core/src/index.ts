/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {createAiSlice, useStoreWithAi} from './AiSlice';

export type {AiSliceState, AiSliceOptions} from './AiSlice';
// @deprecated Use `Chat.Messages` instead.
export {AnalysisResultsContainer} from './components/AnalysisResultsContainer';
export {AnalysisResult} from './components/AnalysisResult';
export {ErrorMessage} from './components/ErrorMessage';
export {useScrollToBottom} from './hooks/useScrollToBottom';
export {useSessionChat} from './hooks/useSessionChat';
export {useElapsedTime} from './hooks/useElapsedTime';
export {Chat} from './components/Chat';

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

export {AiSliceConfig, createDefaultAiConfig} from '@sqlrooms/ai-config';
export {AiThinkingDots} from './components/AiThinkingDots';
export {
  cleanupPendingAnalysisResults,
  ToolAbortError,
  extractModelsFromSettings,
  shouldEndAnalysis,
  humanizeToolName,
  generateReasoningTitle,
} from './utils';
export type {
  AddToolApprovalResponse,
  AddToolOutput,
  StoredTool,
  StoredToolSet,
  ToolRendererProps,
  ToolRenderer,
  ToolRendererRegistry,
  ToolRenderers,
  ToolTimingEntry,
  AssistantMessageMetadata,
} from './types';
export {fixIncompleteToolCalls} from './utils';
export type {ToolCallSummary, ReasoningTitleDescriptor} from './utils';

export {streamSubAgent, updateAgentToolCallData} from './agents/AgentUtils';
export type {
  AgentStreamOutput,
  AgentToolCall,
  AgentToolCallAdditionalData,
  PendingSubAgentApproval,
} from './agents/AgentUtils';
export {ReasoningBox, ReasoningTitle} from './components/ReasoningBox';
export {ExpandableContent} from './components/ExpandableContent';
