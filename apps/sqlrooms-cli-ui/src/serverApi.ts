import {
  createPersistenceController,
  type PersistenceController,
} from '@sqlrooms/room-shell';
import {PersistStorage, StorageValue} from 'zustand/middleware';
import {RuntimeConfig} from './runtimeConfig';
import type {AiSettingsSliceConfig} from '@sqlrooms/ai';

type DuckDbLikeConnector = {
  query: (sql: string) => PromiseLike<any>;
};

const UI_STATE_KEY = 'default';
const PERSIST_DEBOUNCE_MS = 300;

export type DuckDbPersistStorage = PersistStorage<any> & {
  controller: PersistenceController<string>;
  flush: () => Promise<void>;
  markStateSnapshotSaved: (state: unknown) => void;
};

function sanitizeIdent(ident: string): string {
  // Minimal guardrail: we only allow typical DuckDB identifier characters.
  // This avoids SQL injection via identifiers when using string interpolation.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) {
    throw new Error(`Invalid DuckDB identifier: ${ident}`);
  }
  return ident;
}

function nsRef(namespace: string): string {
  return sanitizeIdent(namespace);
}

async function ensureUiStateTable(
  connector: DuckDbLikeConnector,
  namespace: string,
) {
  // NOTE: We intentionally do NOT `CREATE SCHEMA __sqlrooms` here because in some
  // modes `__sqlrooms` may be an ATTACH alias (meta DB). Schema creation would
  // fail in that case. The server is responsible for ensuring the namespace exists
  // when it's a schema in the main DB.
  const ns = nsRef(namespace);
  await connector.query(
    `CREATE TABLE IF NOT EXISTS ${ns}.ui_state (key TEXT PRIMARY KEY, payload_json JSON, updated_at TIMESTAMPTZ DEFAULT now())`,
  );
}

function escapeLiteral(json: string) {
  return json.replace(/'/g, "''");
}

export function createDuckDbPersistStorage(
  connector: DuckDbLikeConnector,
  options?: {namespace?: string},
): DuckDbPersistStorage {
  const namespace = options?.namespace || '__sqlrooms';
  let ensured: Promise<void> | null = null;
  let handlersRegistered = false;
  const ensure = () => {
    ensured = ensured ?? ensureUiStateTable(connector, namespace);
    return ensured;
  };
  const controller = createPersistenceController<string>({
    autosaveDelayMs: PERSIST_DEBOUNCE_MS,
    adapter: {
      load: async () => {
        await ensure();
        const ns = nsRef(namespace);
        const result: any = await connector.query(
          `SELECT payload_json FROM ${ns}.ui_state WHERE key='${UI_STATE_KEY}' LIMIT 1`,
        );
        const rows = result?.toArray ? result.toArray() : [];
        const payload = rows?.[0]?.payload_json;
        if (payload === undefined) return null;
        return typeof payload === 'string' ? payload : JSON.stringify(payload);
      },
      save: async (body) => {
        await ensure();
        const escaped = escapeLiteral(body);
        const ns = nsRef(namespace);
        await connector.query(
          `INSERT OR REPLACE INTO ${ns}.ui_state (key, payload_json, updated_at) VALUES ('${UI_STATE_KEY}', CAST('${escaped}' AS JSON), now())`,
        );
      },
      remove: async () => {
        await ensure();
        const ns = nsRef(namespace);
        await connector.query(
          `DELETE FROM ${ns}.ui_state WHERE key='${UI_STATE_KEY}'`,
        );
      },
    },
  });
  const registerFlushHandlers = () => {
    if (handlersRegistered || typeof window === 'undefined') return;
    handlersRegistered = true;
    const flushNow = () => {
      void controller.flush('final-flush');
    };
    window.addEventListener('beforeunload', flushNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushNow();
      }
    });
  };

  return {
    controller,
    flush: () => controller.flush('flush'),
    markStateSnapshotSaved: (state: unknown) => {
      controller.markSnapshotSaved(JSON.stringify(state));
    },
    getItem: async (_name: string): Promise<StorageValue<any> | null> => {
      const body = await controller.hydrate();
      if (body === null) return null;
      let parsed: unknown = body;
      if (typeof body === 'string') {
        try {
          parsed = JSON.parse(body);
        } catch {
          parsed = body;
        }
      }
      return {state: parsed, version: 0};
    },

    setItem: async (_name: string, value: StorageValue<any>): Promise<void> => {
      registerFlushHandlers();
      controller.setSnapshot(JSON.stringify(value.state ?? value), 'setItem');
    },

    removeItem: async (_name: string): Promise<void> => {
      await controller.flush('remove');
      controller.markSnapshotSaved(null);
      await controller.pause(async () => {
        await ensure();
        const ns = nsRef(namespace);
        await connector.query(
          `DELETE FROM ${ns}.ui_state WHERE key='${UI_STATE_KEY}'`,
        );
      });
    },
  };
}

function getApiBaseUrl(config: RuntimeConfig): string {
  return (config.apiBaseUrl || '').replace(/\/$/, '');
}

function getApiHeaders(config: RuntimeConfig): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(config.wsAuthToken ? {'X-SQLRooms-Token': config.wsAuthToken} : {}),
  };
}

export async function saveAiSettingsToServer(
  config: RuntimeConfig,
  payload: {
    settings: AiSettingsSliceConfig;
    defaultProvider?: string;
    defaultModel?: string;
  },
): Promise<void> {
  const res = await fetch(`${getApiBaseUrl(config)}/api/ai/settings`, {
    method: 'PUT',
    headers: getApiHeaders(config),
    body: JSON.stringify(payload),
  });
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
  const res = await fetch(uploadUrl, {method: 'POST', body: form});
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.statusText}`);
  }
  const data = (await res.json()) as {path: string};
  return validateServerPath(data.path);
}
