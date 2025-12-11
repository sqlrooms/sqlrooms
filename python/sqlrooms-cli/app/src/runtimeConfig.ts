export type RuntimeConfig = {
  wsUrl?: string;
  apiBaseUrl?: string;
  llmProvider?: string;
  llmModel?: string;
  apiKey?: string;
  dbPath?: string;
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
