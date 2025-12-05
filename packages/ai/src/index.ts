/**
 * {@include ../README.md}
 * @packageDocumentation
 */

// Tools
export {QueryToolResult} from './tools/query/QueryToolResult';
export {
  QueryToolParameters,
  createQueryTool,
  getQuerySummary,
  type QueryToolLlmResult,
  type QueryToolAdditionalData,
  type QueryToolOptions,
} from './tools/query/queryTool';
export {createDefaultAiTools} from './tools/defaultTools';
export type {DefaultToolsOptions} from './tools/defaultTools';
export {
  createDefaultAiInstructions,
  formatTablesForLLM,
} from './tools/defaultInstructions';

// From @sqlrooms/ai-core - State/Logic
export {createAiSlice, useStoreWithAi} from '@sqlrooms/ai-core';
export type {AiSliceState} from '@sqlrooms/ai-core';
export {useScrollToBottom} from '@sqlrooms/ai-core';
export {useAiChat} from '@sqlrooms/ai-core';
export {AiThinkingDots} from '@sqlrooms/ai-core';
export {cleanupPendingAnalysisResults, ToolAbortError} from '@sqlrooms/ai-core';
export {
  convertToAiSDKTools,
  completeIncompleteToolCalls,
} from '@sqlrooms/ai-core';
export {processAgentStream, updateAgentToolCallData} from '@sqlrooms/ai-core';
export type {
  AgentStreamResult,
  UIMessageChunk,
  AgentToolCall,
  AgentToolCallAdditionalData,
} from '@sqlrooms/ai-core';

// From @sqlrooms/ai-core - Components
export {AnalysisResultsContainer} from '@sqlrooms/ai-core';
export {AnalysisResult} from '@sqlrooms/ai-core';
export {PromptSuggestions} from '@sqlrooms/ai-core';
export {ModelSelector} from '@sqlrooms/ai-core';
export {SessionControls} from '@sqlrooms/ai-core';
export {QueryControls} from '@sqlrooms/ai-core';
export {DeleteSessionDialog} from '@sqlrooms/ai-core';
export {SessionActions} from '@sqlrooms/ai-core';
export {SessionDropdown} from '@sqlrooms/ai-core';
export {SessionTitle} from '@sqlrooms/ai-core';
export type {SessionType} from '@sqlrooms/ai-core';
export {ToolErrorMessage} from '@sqlrooms/ai-core';
export {ToolCallInfo} from '@sqlrooms/ai-core';
export {ReasoningBox} from '@sqlrooms/ai-core';

// From @sqlrooms/ai-config
export {
  AiSliceConfig,
  createDefaultAiConfig,
  AiSettingsSliceConfig,
  AnalysisSessionSchema,
  AnalysisResultSchema,
  ErrorMessageSchema,
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
