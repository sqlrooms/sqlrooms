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
  createAiQuickLoginSlice,
  useStoreWithAiQuickLogin,
} from './AiQuickLoginSlice';
export type {AiQuickLoginSliceState} from './AiQuickLoginSlice';
export {
  AiConnectDialog,
  AiProviderConnectButton,
  AiProviderStatusList,
  useAiProviderAuth,
} from './connect';
export {resolveLoginTargetsFromProviders} from './loginTargets';
export {AiQuickLoginDialog, AiQuickLoginButton} from './quick-login';
export type {
  AiAuthClient,
  AiAuthCompletionPayload,
  AiAuthCompletionResult,
  AiConnectFlowType,
  AiConnectStep,
  AiCredentialStore,
  AiLoginTarget,
  AiProviderAdapter,
  AiProviderAuthInstructions,
  AiProviderCredential,
  AiProviderRuntimeResolver,
  AiProviderStatus,
  AiQuickLoginMode,
} from './types';
