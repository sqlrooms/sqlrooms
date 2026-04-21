import type {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import type {ProviderRuntime} from '@sqlrooms/ai-core';

export type AiConnectFlowType =
  | 'api_key'
  | 'oauth_auto'
  | 'oauth_popup'
  | 'oauth_redirect'
  | 'oauth_code'
  | 'device_code'
  | 'local'
  | 'external_credentials'
  | 'oauth_to_api_key';

export type AiConnectStep =
  | 'idle'
  | 'pick_provider'
  | 'pick_method'
  | 'oauth_wait'
  | 'device_code'
  | 'enter_code'
  | 'enter_api_key'
  | 'success'
  | 'error';

export type AiProviderAuthInstructions = {
  providerId: string;
  authMethodId: string;
  flowType: AiConnectFlowType | string;
  url?: string;
  instructions: string;
  codeFormatHint?: string;
  pollIntervalMs?: number;
  userCode?: string;
};

export type AiProviderCredential = {
  type: string;
  apiKey?: string;
  authToken?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  selectedAuthMethod?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, string>;
};

export type AiProviderStatus = NonNullable<
  AiSettingsSliceConfig['providers'][string]['status']
>;

export type AiAuthCompletionPayload = {
  code?: string;
  apiKey?: string;
  verifier?: string;
  redirectUri?: string;
  [key: string]: unknown;
};

export type AiAuthCompletionResult = {
  ok: boolean;
  status?: AiProviderStatus;
  credentialType?: string;
};

export interface AiCredentialStore {
  load(providerId: string): Promise<AiProviderCredential | null>;
  save(providerId: string, credential: AiProviderCredential): Promise<void>;
  delete(providerId: string): Promise<void>;
}

export type AiAuthClient = {
  listProviders: () => Promise<AiSettingsSliceConfig['providers']>;
  getStatus: (
    providerId?: string,
  ) => Promise<
    AiProviderStatus | Record<string, AiProviderStatus> | null | undefined
  >;
  startAuth: (
    providerId: string,
    authMethodId: string,
  ) => Promise<AiProviderAuthInstructions>;
  completeAuth: (
    providerId: string,
    authMethodId: string,
    payload?: AiAuthCompletionPayload,
  ) => Promise<AiAuthCompletionResult>;
  logout: (providerId: string) => Promise<void>;
  testAuth?: (providerId: string) => Promise<{ok: boolean}>;
};

export type AiProviderAdapterContext = {
  providerId: string;
  provider: AiSettingsSliceConfig['providers'][string];
  authMethod: NonNullable<
    AiSettingsSliceConfig['providers'][string]['authMethods']
  >[number];
  credentialStore: AiCredentialStore;
  existingCredential: AiProviderCredential | null;
};

export interface AiProviderAdapter {
  startAuth?: (
    ctx: AiProviderAdapterContext,
  ) => Promise<AiProviderAuthInstructions>;
  completeAuth?: (
    ctx: AiProviderAdapterContext,
    payload?: AiAuthCompletionPayload,
  ) => Promise<AiProviderCredential | null | undefined>;
  logout?: (ctx: AiProviderAdapterContext) => Promise<void>;
  getStatus?: (
    ctx: AiProviderAdapterContext,
  ) => Promise<AiProviderStatus | null>;
  resolveRuntime?: (
    ctx: AiProviderAdapterContext & {modelId: string},
  ) => Promise<ProviderRuntime | null | undefined>;
}

export type AiProviderRuntimeResolver = (args: {
  provider: string;
  modelId: string;
  baseUrl?: string;
}) => Promise<ProviderRuntime | undefined> | ProviderRuntime | undefined;
