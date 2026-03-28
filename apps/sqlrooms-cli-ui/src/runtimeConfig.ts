export type RuntimeConfig = {
  wsUrl?: string;
  apiBaseUrl?: string;
  llmProvider?: string;
  llmModel?: string;
  apiKey?: string;
  aiProviders?: Record<
    string,
    {
      title?: string;
      kind?: string;
      baseUrl: string;
      apiKey?: string;
      models: Array<{modelName: string}>;
      defaultAuthMethod?: string;
      authMethods?: Array<{
        id: string;
        type:
          | 'api_key'
          | 'env_api_key'
          | 'oauth_auto'
          | 'oauth_code'
          | 'device_code'
          | 'local'
          | 'external_credentials'
          | 'oauth_to_api_key';
        label: string;
        description?: string;
        experimental?: boolean;
        envVar?: string;
        metadata?: Record<string, string>;
      }>;
      experimental?: boolean;
      status?: {
        hasCredentials?: boolean;
        credentialType?: string;
        expiresAt?: number;
        selectedAuthMethod?: string;
        status?: string;
      };
      selectedAuthMethod?: string;
      hasCredentials?: boolean;
      credentialType?: string;
      expiresAt?: number;
      proxyEnabled?: boolean;
      upstreamBaseUrl?: string;
      authMethodType?: string;
    }
  >;
  dbPath?: string;
  metaNamespace?: string;
  dbBridge?: {
    id: string;
    connections: Array<{
      id: string;
      engineId: string;
      title: string;
      runtimeSupport?: 'browser' | 'server' | 'both';
      requiresBridge?: boolean;
      bridgeId?: string;
      isCore?: boolean;
      config?: Record<string, string>;
    }>;
    diagnostics?: Array<{
      id: string;
      engineId: string;
      title: string;
      available: boolean;
      error?: string;
      reason?: string;
      requiredPackages?: string[];
      installCommands?: {
        uvProject?: string;
        uvxRelaunch?: string;
        uvxWith?: string;
      };
    }>;
    supportedEngines?: string[];
    engineConfigFields?: Record<
      string,
      Array<{
        key: string;
        label: string;
        placeholder?: string;
        secret?: boolean;
        required?: boolean;
      }>
    >;
  };
};

export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return {};
    return (await res.json()) as RuntimeConfig;
  } catch {
    return {};
  }
}
