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
  createAiSettingsSlice,
  useStoreWithAiSettings,
  AiSettingsSliceConfig,
  createDefaultAiSettings,
} from './AiSettingsSlice';

export type {AiSettingsConfigSliceState as AiModelConfigState} from './AiSettingsSlice';

export {AiSettingsPanel} from './components/settings/AiSettingsPanel';
export {AiProvidersSettings} from './components/settings/AiProvidersSettings';
export {AiModelsSettings} from './components/settings/AiModelsSettings';
export {AiModelParameters} from './components/settings/AiModelParameters';
export {AiModelUsage} from './components/settings/AiModelUsage';
export type {ModelUsageData} from './components/settings/AiModelUsage';
export {getApiKey, getBaseUrl, extractModelsFromConfig} from './utils';
