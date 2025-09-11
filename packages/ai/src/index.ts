/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  AiSliceConfig,
  createAiSlice,
  useStoreWithAi,
  createDefaultAiConfig,
} from './AiSlice';

export type {AiSliceState} from './AiSlice';
export {QueryControls} from './components/QueryControls';
export {AnalysisResultsContainer} from './components/AnalysisResultsContainer';
export {AnalysisResult} from './components/AnalysisResult';
export {useScrollToBottom} from './hooks/useScrollToBottom';
export type {AiSliceTool} from './AiSlice';
export {QueryToolResult} from './components/tools/QueryToolResult';
export {getDefaultInstructions} from './analysis';

export * from './components/ModelSelector';
export * from './components/SessionControls';
export * from './components/QueryControls';
export * from './components/session/DeleteSessionDialog';
export * from './components/session/SessionActions';
export * from './components/session/SessionDropdown';
export * from './components/session/SessionTitle';
export * from './components/session/SessionType';

// AI Chat UI Configuration exports
export {
  createAiModelConfigSlice,
  useStoreWithAiModelConfig,
  AiModelSliceConfig,
  createDefaultAiModelConfig,
} from './AiConfigSlice';

export type {AiModelConfigSliceState as AiModelConfigState} from './AiConfigSlice';

export {AiConfigPanel} from './components/config/AiConfigPanel';
export {ProvidersConfig} from './components/config/ProvidersConfig';
export {ModelsConfig} from './components/config/ModelsConfig';
export {AiModelParameters} from './components/config/AiModelParameters';
export {AiModelSelection} from './components/config/AiModelConfig';
export {AiModelSelector} from './components/config/AiModelSelector';
export {AiModelUsage} from './components/config/AiModelUsage';
export type {ModelUsageData} from './components/config/AiModelUsage';
export {getApiKey, getBaseUrl, getSelectedModel} from './utils';
