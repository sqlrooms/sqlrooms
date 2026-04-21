import type {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import type {ProviderRuntime} from '@sqlrooms/ai-core';
import type {
  AiAuthClient,
  AiAuthCompletionPayload,
  AiAuthCompletionResult,
  AiCredentialStore,
  AiProviderAdapter,
  AiProviderAuthInstructions,
  AiProviderCredential,
  AiProviderStatus,
} from './types';

function createStatusFromCredential(
  credential: AiProviderCredential | null,
): AiProviderStatus {
  if (!credential) {
    return {
      hasCredentials: false,
      credentialType: null,
      expiresAt: null,
      selectedAuthMethod: null,
      status: 'disconnected',
    };
  }

  return {
    hasCredentials: true,
    credentialType: credential.type,
    expiresAt: credential.expiresAt ?? null,
    selectedAuthMethod: credential.selectedAuthMethod ?? null,
    status: 'connected',
  };
}

function getMethod(
  providers: AiSettingsSliceConfig['providers'],
  providerId: string,
  authMethodId: string,
) {
  const provider = providers[providerId];
  if (!provider) {
    throw new Error(`Unknown provider "${providerId}".`);
  }
  const authMethod = provider.authMethods.find(
    (method) => method.id === authMethodId,
  );
  if (!authMethod) {
    throw new Error(
      `Unknown auth method "${authMethodId}" for provider "${providerId}".`,
    );
  }
  return {provider, authMethod};
}

async function providersWithStatuses(
  providers: AiSettingsSliceConfig['providers'],
  credentialStore: AiCredentialStore,
) {
  const entries = await Promise.all(
    Object.entries(providers).map(async ([providerId, provider]) => {
      const credential = await credentialStore.load(providerId);
      return [
        providerId,
        {
          ...provider,
          status: createStatusFromCredential(credential),
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export function createLocalStorageAiCredentialStore(
  keyPrefix = 'sqlrooms.ai.connect',
): AiCredentialStore {
  return {
    async load(providerId) {
      if (typeof window === 'undefined') return null;
      const value = window.localStorage.getItem(`${keyPrefix}.${providerId}`);
      if (!value) return null;
      try {
        return JSON.parse(value) as AiProviderCredential;
      } catch {
        return null;
      }
    },
    async save(providerId, credential) {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(
        `${keyPrefix}.${providerId}`,
        JSON.stringify(credential),
      );
    },
    async delete(providerId) {
      if (typeof window === 'undefined') return;
      window.localStorage.removeItem(`${keyPrefix}.${providerId}`);
    },
  };
}

export class BrowserAiAuthClient implements AiAuthClient {
  private readonly getProvidersInternal: () =>
    | AiSettingsSliceConfig['providers']
    | Promise<AiSettingsSliceConfig['providers']>;

  constructor(
    private readonly options: {
      getProviders: () =>
        | AiSettingsSliceConfig['providers']
        | Promise<AiSettingsSliceConfig['providers']>;
      credentialStore: AiCredentialStore;
      adapters?: Record<string, AiProviderAdapter>;
    },
  ) {
    this.getProvidersInternal = options.getProviders;
  }

  async listProviders() {
    const providers = await this.getProvidersInternal();
    return providersWithStatuses(providers, this.options.credentialStore);
  }

  async getStatus(providerId?: string) {
    const providers = await this.getProvidersInternal();
    if (providerId) {
      const credential = await this.options.credentialStore.load(providerId);
      const adapter = this.options.adapters?.[providerId];
      const provider = providers[providerId];
      const authMethodId =
        credential?.selectedAuthMethod ||
        provider?.defaultAuthMethod ||
        provider?.authMethods?.[0]?.id;
      const authMethod = provider?.authMethods.find(
        (method) => method.id === authMethodId,
      );
      if (provider && authMethod && adapter?.getStatus) {
        const adapterStatus = await adapter.getStatus({
          providerId,
          provider,
          authMethod,
          credentialStore: this.options.credentialStore,
          existingCredential: credential,
        });
        if (adapterStatus) return adapterStatus;
      }
      return createStatusFromCredential(credential);
    }

    const statuses = await Promise.all(
      Object.keys(providers).map(async (id) => [
        id,
        createStatusFromCredential(await this.options.credentialStore.load(id)),
      ]),
    );
    return Object.fromEntries(statuses);
  }

  async startAuth(providerId: string, authMethodId: string) {
    const providers = await this.getProvidersInternal();
    const {provider, authMethod} = getMethod(
      providers,
      providerId,
      authMethodId,
    );
    const existingCredential =
      await this.options.credentialStore.load(providerId);
    const adapter = this.options.adapters?.[providerId];

    if (adapter?.startAuth) {
      return adapter.startAuth({
        providerId,
        provider,
        authMethod,
        credentialStore: this.options.credentialStore,
        existingCredential,
      });
    }

    if (authMethod.type === 'api_key') {
      return {
        providerId,
        authMethodId,
        flowType: 'api_key',
        instructions:
          authMethod.description ||
          `Paste the API key for ${provider.title || providerId}.`,
      };
    }

    if (authMethod.type === 'local') {
      await this.options.credentialStore.save(providerId, {
        type: 'local',
        selectedAuthMethod: authMethodId,
        baseUrl: provider.baseUrl,
      });
      return {
        providerId,
        authMethodId,
        flowType: 'local',
        instructions:
          authMethod.description ||
          `Using the local runtime configured at ${provider.baseUrl}.`,
      };
    }

    if (authMethod.type === 'external_credentials') {
      return {
        providerId,
        authMethodId,
        flowType: 'external_credentials',
        instructions:
          authMethod.description ||
          'Configure credentials outside the app, then refresh the provider status.',
        url: authMethod.metadata?.url,
      };
    }

    return {
      providerId,
      authMethodId,
      flowType: authMethod.type,
      url: authMethod.metadata?.authUrl || authMethod.metadata?.url,
      instructions:
        authMethod.description ||
        'Continue with the provider login flow, then finish the connection in this dialog.',
      codeFormatHint: authMethod.metadata?.codeFormatHint,
      pollIntervalMs: authMethod.metadata?.pollIntervalMs
        ? Number(authMethod.metadata.pollIntervalMs)
        : undefined,
      userCode: authMethod.metadata?.userCode,
    };
  }

  async completeAuth(
    providerId: string,
    authMethodId: string,
    payload: AiAuthCompletionPayload = {},
  ): Promise<AiAuthCompletionResult> {
    const providers = await this.getProvidersInternal();
    const {provider, authMethod} = getMethod(
      providers,
      providerId,
      authMethodId,
    );
    const existingCredential =
      await this.options.credentialStore.load(providerId);
    const adapter = this.options.adapters?.[providerId];

    if (adapter?.completeAuth) {
      const credential = await adapter.completeAuth(
        {
          providerId,
          provider,
          authMethod,
          credentialStore: this.options.credentialStore,
          existingCredential,
        },
        payload,
      );
      if (credential) {
        await this.options.credentialStore.save(providerId, {
          ...credential,
          selectedAuthMethod: authMethodId,
        });
      }
      return {
        ok: true,
        credentialType: credential?.type,
        status: createStatusFromCredential(
          credential ?? (await this.options.credentialStore.load(providerId)),
        ),
      };
    }

    if (authMethod.type === 'api_key') {
      if (!payload.apiKey?.trim()) {
        throw new Error('An API key is required.');
      }
      await this.options.credentialStore.save(providerId, {
        type: 'api_key',
        apiKey: payload.apiKey.trim(),
        selectedAuthMethod: authMethodId,
        baseUrl: provider.baseUrl,
      });
      return {
        ok: true,
        credentialType: 'api_key',
        status: createStatusFromCredential(
          await this.options.credentialStore.load(providerId),
        ),
      };
    }

    if (authMethod.type === 'local') {
      await this.options.credentialStore.save(providerId, {
        type: 'local',
        selectedAuthMethod: authMethodId,
        baseUrl: provider.baseUrl,
      });
      return {
        ok: true,
        credentialType: 'local',
        status: createStatusFromCredential(
          await this.options.credentialStore.load(providerId),
        ),
      };
    }

    throw new Error(
      `The "${authMethod.label}" flow needs a provider adapter in browser-only mode.`,
    );
  }

  async logout(providerId: string) {
    const providers = await this.getProvidersInternal();
    const provider = providers[providerId];
    const credential = await this.options.credentialStore.load(providerId);
    const authMethodId =
      credential?.selectedAuthMethod ||
      provider?.defaultAuthMethod ||
      provider?.authMethods?.[0]?.id;
    const authMethod = provider?.authMethods.find(
      (method) => method.id === authMethodId,
    );
    const adapter = this.options.adapters?.[providerId];
    if (provider && authMethod && adapter?.logout) {
      await adapter.logout({
        providerId,
        provider,
        authMethod,
        credentialStore: this.options.credentialStore,
        existingCredential: credential,
      });
    }
    await this.options.credentialStore.delete(providerId);
  }

  async testAuth(providerId: string) {
    const credential = await this.options.credentialStore.load(providerId);
    return {ok: Boolean(credential)};
  }

  async resolveRuntime(args: {
    providerId: string;
    modelId: string;
  }): Promise<ProviderRuntime | undefined> {
    const providers = await this.getProvidersInternal();
    const provider = providers[args.providerId];
    if (!provider) return undefined;
    const credential = await this.options.credentialStore.load(args.providerId);
    const authMethodId =
      credential?.selectedAuthMethod ||
      provider.defaultAuthMethod ||
      provider.authMethods?.[0]?.id;
    const authMethod = provider.authMethods.find(
      (method) => method.id === authMethodId,
    );
    const adapter = this.options.adapters?.[args.providerId];

    if (authMethod && adapter?.resolveRuntime) {
      const runtime = await adapter.resolveRuntime({
        providerId: args.providerId,
        provider,
        authMethod,
        credentialStore: this.options.credentialStore,
        existingCredential: credential,
        modelId: args.modelId,
      });
      if (runtime) return runtime;
    }

    if (!credential) return undefined;
    const token = credential.authToken || credential.accessToken;
    return {
      apiKey: credential.apiKey,
      authToken: token,
      baseUrl: credential.baseUrl || provider.baseUrl,
      headers:
        credential.headers ||
        (token ? {Authorization: `Bearer ${token}`} : undefined),
    };
  }
}

export class HttpAiAuthClient implements AiAuthClient {
  constructor(private readonly options: {apiBaseUrl?: string} = {}) {}

  private url(path: string) {
    return `${this.options.apiBaseUrl || ''}${path}`;
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.url(path), init);
    const body = (await res.json().catch(() => ({}))) as T & {error?: string};
    if (!res.ok) {
      throw new Error(body.error || `Server returned ${res.status}`);
    }
    return body;
  }

  async listProviders() {
    const body = await this.json<{
      providers: AiSettingsSliceConfig['providers'];
    }>('/api/ai/auth/providers');
    return body.providers;
  }

  async getStatus(providerId?: string) {
    const url = providerId
      ? `/api/ai/auth/status?providerId=${encodeURIComponent(providerId)}`
      : '/api/ai/auth/status';
    return this.json<
      AiProviderStatus | Record<string, AiProviderStatus> | null | undefined
    >(url);
  }

  async startAuth(providerId: string, authMethodId: string) {
    return this.json<AiProviderAuthInstructions>('/api/ai/auth/start', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({providerId, authMethodId}),
    });
  }

  async completeAuth(
    providerId: string,
    authMethodId: string,
    payload: AiAuthCompletionPayload = {},
  ) {
    return this.json<AiAuthCompletionResult>('/api/ai/auth/complete', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({providerId, authMethodId, ...payload}),
    });
  }

  async logout(providerId: string) {
    await this.json('/api/ai/auth/logout', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({providerId}),
    });
  }

  async testAuth(providerId: string) {
    return this.json<{ok: boolean}>('/api/ai/auth/test', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({providerId}),
    });
  }
}
