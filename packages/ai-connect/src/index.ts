/**
 * {@include ../README.md}
 * @packageDocumentation
 */

export {
  BrowserAiAuthClient,
  HttpAiAuthClient,
  createLocalStorageAiCredentialStore,
} from './clients';
export {
  createAiAssistantSettingsSlices,
  createAiConnectSlice,
  useStoreWithAiConnect,
} from './AiConnectSlice';
export type {AiConnectSliceState} from './AiConnectSlice';
export {
  AiConnectDialog,
  AiProviderConnectButton,
  AiProviderStatusList,
  useAiProviderAuth,
} from './connect';
export type {
  AiAuthClient,
  AiAuthCompletionPayload,
  AiAuthCompletionResult,
  AiConnectFlowType,
  AiConnectStep,
  AiCredentialStore,
  AiProviderAdapter,
  AiProviderAuthInstructions,
  AiProviderCredential,
  AiProviderRuntimeResolver,
  AiProviderStatus,
} from './types';
