import {createAnthropic} from '@ai-sdk/anthropic';
import {
  BrowserAiAuthClient,
  createLocalStorageAiCredentialStore,
  type AiProviderAdapter,
} from '@sqlrooms/ai-connect';
import type {AiSettingsSliceConfig} from '@sqlrooms/ai-settings';

const credentialStore = createLocalStorageAiCredentialStore(
  'sqlrooms.examples.ai.connect',
);
const STORAGE_KEY_PREFIX = 'sqlrooms.examples.ai.connect';

function createBrowserCodeAdapter(options: {
  providerLabel: string;
  authUrl: string;
  credentialType: 'api_key' | 'auth_token';
}) {
  const adapter: AiProviderAdapter = {
    async startAuth(ctx) {
      const label = ctx.authMethod.label;
      const needsDeviceCode = ctx.authMethod.type === 'device_code';
      return {
        providerId: ctx.providerId,
        authMethodId: ctx.authMethod.id,
        flowType: needsDeviceCode ? 'device_code' : 'oauth_code',
        url: ctx.authMethod.metadata?.authUrl || options.authUrl,
        instructions:
          ctx.authMethod.description ||
          `Open ${options.providerLabel}, complete the sign-in flow, then paste the resulting code or compatible token here.`,
        codeFormatHint:
          label.toLowerCase().includes('api key') ||
          options.credentialType === 'api_key'
            ? 'Paste the resulting API key'
            : 'Paste the returned code or token',
        userCode: needsDeviceCode
          ? ctx.authMethod.metadata?.userCode
          : undefined,
      };
    },
    async completeAuth(ctx, payload) {
      const secret = (payload?.apiKey || payload?.code || '').trim();
      if (!secret) {
        throw new Error(
          'Paste the code or token from the provider flow first.',
        );
      }
      return {
        type: options.credentialType,
        apiKey: options.credentialType === 'api_key' ? secret : undefined,
        authToken: options.credentialType === 'auth_token' ? secret : undefined,
        selectedAuthMethod: ctx.authMethod.id,
        baseUrl: ctx.provider.baseUrl,
      };
    },
  };

  return adapter;
}

export const exampleConnectAdapters: Record<string, AiProviderAdapter> = {
  anthropic: {
    ...createBrowserCodeAdapter({
      providerLabel: 'Claude',
      authUrl: 'https://claude.ai/',
      credentialType: 'api_key',
    }),
    async resolveRuntime(ctx) {
      const apiKey =
        ctx.existingCredential?.apiKey || ctx.existingCredential?.authToken;
      if (!apiKey) return undefined;
      return {
        apiKey,
        baseUrl: ctx.provider.baseUrl,
        customModelFactory: (modelId) =>
          createAnthropic({
            apiKey,
            baseURL: ctx.provider.baseUrl,
          }).messages(modelId) as any,
      };
    },
  },
  openai: createBrowserCodeAdapter({
    providerLabel: 'ChatGPT',
    authUrl: 'https://chatgpt.com/',
    credentialType: 'api_key',
  }),
};

export function createExampleBrowserAiAuthClient(
  getProviders: () => AiSettingsSliceConfig['providers'],
) {
  return new BrowserAiAuthClient({
    getProviders,
    credentialStore,
    adapters: exampleConnectAdapters,
  });
}

export function getExampleProviderRuntime(
  providerId: string,
  _modelId: string,
  providerBaseUrl?: string,
) {
  if (typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem(
    `${STORAGE_KEY_PREFIX}.${providerId}`,
  );
  if (!raw) return undefined;

  const credential = JSON.parse(raw) as {
    apiKey?: string;
    authToken?: string;
    baseUrl?: string;
  };
  const baseUrl = credential.baseUrl || providerBaseUrl;

  if (providerId === 'anthropic') {
    const apiKey = credential.apiKey || credential.authToken;
    if (!apiKey) return undefined;
    return {
      apiKey,
      baseUrl,
      customModelFactory: (activeModelId: string) =>
        createAnthropic({
          apiKey,
          baseURL: baseUrl,
        }).messages(activeModelId) as any,
    };
  }

  return {
    apiKey: credential.apiKey || credential.authToken,
    baseUrl,
  };
}
