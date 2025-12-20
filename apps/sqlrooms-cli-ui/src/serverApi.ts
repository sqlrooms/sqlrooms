import {PersistStorage, StorageValue} from 'zustand/middleware';
import {RuntimeConfig} from './runtimeConfig';

type DuckDbLikeConnector = {
  query: (sql: string) => PromiseLike<any>;
};

const UI_STATE_KEY = 'default';

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
): PersistStorage<any> {
  const namespace = options?.namespace || '__sqlrooms';
  let ensured: Promise<void> | null = null;
  const ensure = () => {
    ensured = ensured ?? ensureUiStateTable(connector, namespace);
    return ensured;
  };

  return {
    getItem: async (_name: string): Promise<StorageValue<any> | null> => {
      await ensure();
      const ns = nsRef(namespace);
      const result: any = await connector.query(
        `SELECT payload_json FROM ${ns}.ui_state WHERE key='${UI_STATE_KEY}' LIMIT 1`,
      );
      const rows = result?.toArray ? result.toArray() : [];
      const payload = rows?.[0]?.payload_json;
      if (payload === undefined) return null;
      let parsed = payload;
      if (typeof payload === 'string') {
        try {
          parsed = JSON.parse(payload);
        } catch {
          parsed = payload;
        }
      }
      return {state: parsed, version: 0};
    },

    setItem: async (_name: string, value: StorageValue<any>): Promise<void> => {
      await ensure();
      const body = JSON.stringify(value.state ?? value);
      const escaped = escapeLiteral(body);
      const ns = nsRef(namespace);
      await connector.query(
        `INSERT OR REPLACE INTO ${ns}.ui_state (key, payload_json, updated_at) VALUES ('${UI_STATE_KEY}', CAST('${escaped}' AS JSON), now())`,
      );
    },

    removeItem: async (_name: string): Promise<void> => {
      await ensure();
      const ns = nsRef(namespace);
      await connector.query(
        `DELETE FROM ${ns}.ui_state WHERE key='${UI_STATE_KEY}'`,
      );
    },
  };
}

function getApiBaseUrl(config: RuntimeConfig): string {
  return (config.apiBaseUrl || '').replace(/\/$/, '');
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
  return data.path;
}
