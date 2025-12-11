import {PersistStorage, StorageValue} from 'zustand/middleware';
import {RuntimeConfig} from './runtimeConfig';

type DuckDbLikeConnector = {
  query: (sql: string) => PromiseLike<any>;
};

const STATE_KEY = 'persist';

async function ensureStateTable(connector: DuckDbLikeConnector) {
  await connector.query(`CREATE SCHEMA IF NOT EXISTS __sqlrooms`);
  await connector.query(
    `CREATE TABLE IF NOT EXISTS __sqlrooms.state (key TEXT PRIMARY KEY, payload JSON)`,
  );
}

function escapeLiteral(json: string) {
  return json.replace(/'/g, "''");
}

export function createDuckDbPersistStorage(
  connector: DuckDbLikeConnector,
): PersistStorage<any> {
  let ensured: Promise<void> | null = null;
  const ensure = () => {
    ensured = ensured ?? ensureStateTable(connector);
    return ensured;
  };

  return {
    getItem: async (_name: string): Promise<StorageValue<any> | null> => {
      await ensure();
      const result: any = await connector.query(
        `SELECT payload FROM __sqlrooms.state WHERE key='${STATE_KEY}' LIMIT 1`,
      );
      const rows = result?.toArray ? result.toArray() : [];
      const payload = rows?.[0]?.payload;
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
      await connector.query(
        `INSERT OR REPLACE INTO __sqlrooms.state (key, payload) VALUES ('${STATE_KEY}', CAST('${escaped}' AS JSON))`,
      );
    },

    removeItem: async (_name: string): Promise<void> => {
      await ensure();
      await connector.query(
        `DELETE FROM __sqlrooms.state WHERE key='${STATE_KEY}'`,
      );
    },
  };
}

export async function uploadFileToServer(
  file: File,
  config: RuntimeConfig,
): Promise<string> {
  const uploadUrl = `${(config.apiBaseUrl || '').replace(/\/$/, '')}/api/upload`;
  const form = new FormData();
  form.append('file', file, file.name);
  const res = await fetch(uploadUrl, {method: 'POST', body: form});
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.statusText}`);
  }
  const data = (await res.json()) as {path: string};
  return data.path;
}
