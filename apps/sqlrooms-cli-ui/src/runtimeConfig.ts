export type RuntimeComponentStatus = {
  status: 'starting' | 'ready' | 'error';
  message?: string;
  error?: string;
  details?: string;
};

export type RuntimeStartupStatus = {
  status: 'ready' | 'degraded';
  components?: {
    duckdbWebSocket?: RuntimeComponentStatus;
  };
};

export type RuntimeConfig = {
  wsUrl?: string;
  wsAuthToken?: string;
  apiBaseUrl?: string;
  llmProvider?: string;
  llmModel?: string;
  apiKey?: string;
  configWritable?: boolean;
  aiDevtools?: boolean;
  syncEnabled?: boolean;
  crdtWsUrl?: string;
  crdtRoomId?: string;
  aiProviders?: Record<
    string,
    {
      baseUrl: string;
      apiKey: string;
      models: Array<{modelName: string}>;
    }
  >;
  aiSettings?: {
    providers?: Record<
      string,
      {
        baseUrl: string;
        apiKey: string;
        models: Array<{modelName: string}>;
      }
    >;
    customModels?: Array<{
      baseUrl: string;
      apiKey: string;
      modelName: string;
    }>;
    modelParameters?: {
      maxSteps?: number;
      additionalInstruction?: string;
    };
  };
  dbPath?: string;
  metaNamespace?: string;
  startupStatus?: RuntimeStartupStatus;
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

async function fetchJson<T>(url: string): Promise<T | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  return (await fetchJson<RuntimeConfig>('/api/config')) ?? {};
}

export async function fetchRuntimeStartupStatus(): Promise<
  RuntimeStartupStatus | undefined
> {
  return fetchJson<RuntimeStartupStatus>('/api/status');
}
