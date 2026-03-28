/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {createAiSettingsSlice, useStoreWithAiSettings} from './AiSettingsSlice';
export {
  createAiAssistantSettingsSlices,
  createAiConnectSlice,
  useStoreWithAiConnect,
} from './AiConnectSlice';

export type {AiSettingsSliceState} from './AiSettingsSlice';
export type {
  AiConnectSliceState,
  AiConnectStep,
  AiProviderAuthInstructions,
} from './AiConnectSlice';
export {createDefaultAiSettingsConfig} from './defaultSettings';

export {AiSettingsPanel} from './components/AiSettingsPanel';
export {AiProvidersSettings} from './components/AiProvidersSettings';
export {AiModelsSettings} from './components/AiModelsSettings';
export {AiModelParameters} from './components/AiModelParameters';
export {AiModelUsage} from './components/AiModelUsage';
export type {ModelUsageData} from './components/AiModelUsage';
export {
  AiConnectDialog,
  AiProviderConnectButton,
  AiProviderStatusList,
  useAiProviderAuth,
} from './connect';

export {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
