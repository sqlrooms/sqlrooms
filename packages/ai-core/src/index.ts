/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {createAiSlice, useStoreWithAi} from './AiSlice';

export type {AiSliceState} from './AiSlice';
export {AnalysisResultsContainer} from './components/AnalysisResultsContainer';
export {AnalysisResult} from './components/AnalysisResult';
export {useScrollToBottom} from './hooks/useScrollToBottom';
export {useAiChat} from './hooks/useAiChat';

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
export {ToolCallInfo} from './components/ToolCallInfo';

export {AiSliceConfig, createDefaultAiConfig} from '@sqlrooms/ai-config';
export {AiThinkingDots} from './components/AiThinkingDots';
export {
  cleanupPendingAnalysisResults,
  ToolAbortError,
  extractModelsFromSettings,
} from './utils';
export {
  convertToAiSDKTools,
  completeIncompleteToolCalls,
  createOnToolCompletedHandler,
} from './chatTransport';
export type {AddToolResult} from './types';

export {processAgentStream, updateAgentToolCallData} from './agents/AgentUtils';
export type {
  AgentStreamResult,
  UIMessageChunk,
  AgentToolCall,
  AgentToolCallAdditionalData,
} from './agents/AgentUtils';
export {ReasoningBox} from './components/ReasoningBox';
