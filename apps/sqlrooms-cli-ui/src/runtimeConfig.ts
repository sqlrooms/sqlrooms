export type RuntimeConfig = {
  wsUrl?: string;
  apiBaseUrl?: string;
  llmProvider?: string;
  llmModel?: string;
  apiKey?: string;
  aiProviders?: Record<
    string,
    {
      baseUrl: string;
      apiKey: string;
      models: Array<{modelName: string}>;
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
