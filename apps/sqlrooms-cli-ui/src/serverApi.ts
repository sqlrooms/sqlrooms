import {authorizedFetch} from './browserAuth';
import {RuntimeConfig} from './runtimeConfig';
import type {AiSettingsSliceConfig} from '@sqlrooms/ai';

export {
  createDuckDbPersistStorage,
  type DuckDbPersistStorage,
} from '@sqlrooms/room-shell';

function getApiBaseUrl(config: RuntimeConfig): string {
  return (config.apiBaseUrl || '').replace(/\/$/, '');
}

function getApiHeaders(config: RuntimeConfig): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(config.wsAuthToken ? {'X-SQLRooms-Token': config.wsAuthToken} : {}),
  };
}

export type McpRuntimeStatus = {
  status: 'off' | 'waiting' | 'ready' | 'working' | 'error';
  enabled: boolean;
  url: string;
  bridge: {
    status: 'waiting' | 'ready';
    pageId?: string;
    lastSeen?: number;
    pendingRequests: number;
    recentActivity?: boolean;
  };
  lastError?: string;
};

export async function fetchMcpStatus(
  config: RuntimeConfig,
): Promise<McpRuntimeStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_000);
  try {
    const response = await authorizedFetch(
      `${getApiBaseUrl(config)}/api/mcp/status`,
      {
        headers: getApiHeaders(config),
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`MCP status failed: ${response.status}`);
    return (await response.json()) as McpRuntimeStatus;
  } finally {
    clearTimeout(timeout);
  }
}

export async function setMcpEnabled(
  config: RuntimeConfig,
  enabled: boolean,
): Promise<McpRuntimeStatus> {
  const response = await authorizedFetch(
    `${getApiBaseUrl(config)}/api/mcp/${enabled ? 'start' : 'stop'}`,
    {method: 'POST', headers: getApiHeaders(config)},
  );
  const body = (await response.json().catch(() => ({}))) as McpRuntimeStatus & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      body.lastError || body.error || `Server returned ${response.status}`,
    );
  }
  return body;
}

export async function saveAiSettingsToServer(
  config: RuntimeConfig,
  payload: {
    settings: AiSettingsSliceConfig;
    defaultProvider?: string;
    defaultModel?: string;
  },
): Promise<void> {
  const res = await authorizedFetch(
    `${getApiBaseUrl(config)}/api/ai/settings`,
    {
      method: 'PUT',
      headers: getApiHeaders(config),
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      (body as {error?: string}).error ?? `Server returned ${res.status}`;
    throw new Error(msg);
  }
}

const SAFE_PATH_RE = /^[A-Za-z0-9_\-./:\\]+$/;

/**
 * Validate and sanitize a server-returned file path to prevent SQL injection
 * when the path is later interpolated into DuckDB queries
 * (e.g. `read_ipc('${filePath}')`).
 */
function validateServerPath(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error('Server returned an invalid upload path (not a string)');
  }

  const normalized = raw.replace(/\\/g, '/');

  if (!SAFE_PATH_RE.test(normalized)) {
    throw new Error(
      `Server returned an upload path with disallowed characters: ${normalized}`,
    );
  }

  if (normalized.includes('..')) {
    throw new Error(
      `Server returned an upload path with directory traversal: ${normalized}`,
    );
  }

  return normalized;
}

export async function uploadFileToServer(
  file: File,
  config: RuntimeConfig,
): Promise<string> {
  const uploadUrl = `${getApiBaseUrl(config)}/api/upload`;
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await authorizedFetch(uploadUrl, {method: 'POST', body: form});
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.statusText}`);
  }
  const data = (await res.json()) as {path: string};
  return validateServerPath(data.path);
}

/** Resolve a file on the DuckDB server; never turn a local path into a browser URL. */
export async function resolveLocalFile(
  input: {path: string; format?: 'csv' | 'parquet' | 'json'},
  config: RuntimeConfig,
  signal?: AbortSignal,
): Promise<{path: string; format: 'csv' | 'parquet' | 'json'}> {
  const response = await authorizedFetch(
    `${getApiBaseUrl(config)}/api/local-file`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(input),
      signal,
    },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.message || 'Cannot resolve local file.');
  return result;
}
