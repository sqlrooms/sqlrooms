/**
 * Startup state for one runtime component reported by the CLI backend.
 */
export type RuntimeComponentStatus = {
  /** Current startup state for the component. */
  status: 'starting' | 'ready' | 'error';
  /** Optional human-readable status message. */
  message?: string;
  /** Optional concise error message when startup failed. */
  error?: string;
  /** Optional diagnostic detail for startup failures. */
  details?: string;
};

/**
 * Aggregate startup status returned by the CLI backend.
 */
export type RuntimeStartupStatus = {
  /** Overall runtime readiness. `degraded` means one or more components are not ready. */
  status: 'ready' | 'degraded';
  /** Per-component startup status details. */
  components?: {
    /** DuckDB websocket backend startup status. */
    duckdbWebSocket?: RuntimeComponentStatus;
  };
};

export type RuntimeConfig = {
  wsUrl?: string;
  wsAuthToken?: string;
  apiBaseUrl?: string;
  llmProvider?: string;
  llmModel?: string;
  configWritable?: boolean;
  experimentalEnabled?: boolean;
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

const RUNTIME_CONFIG_TIMEOUT_MS = 20_000;
const RUNTIME_CONFIG_RETRY_DELAY_MS = 250;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

async function fetchJsonWithRetry<T>(
  url: string,
  {
    timeoutMs = RUNTIME_CONFIG_TIMEOUT_MS,
    retryDelayMs = RUNTIME_CONFIG_RETRY_DELAY_MS,
  }: {
    timeoutMs?: number;
    retryDelayMs?: number;
  } = {},
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const result = await fetchJson<T>(url);
    if (result !== undefined) return result;

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await delay(Math.min(retryDelayMs, remainingMs));
  }

  return undefined;
}

/**
 * Fetches `/api/config`, returning an empty runtime config if the request fails.
 */
export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  return (await fetchJsonWithRetry<RuntimeConfig>('/api/config')) ?? {};
}

/**
 * Fetches `/api/status`, returning `undefined` when the status endpoint fails.
 */
export async function fetchRuntimeStartupStatus(): Promise<
  RuntimeStartupStatus | undefined
> {
  return fetchJson<RuntimeStartupStatus>('/api/status');
}
