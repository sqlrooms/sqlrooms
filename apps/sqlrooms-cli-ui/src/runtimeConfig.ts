export type RuntimeConfig = {
  wsUrl?: string;
  apiBaseUrl?: string;
  llmProvider?: string;
  llmModel?: string;
  apiKey?: string;
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
  };
  // Backward-compatible fallback for older server versions.
  postgresBridgeEnabled?: boolean;
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
