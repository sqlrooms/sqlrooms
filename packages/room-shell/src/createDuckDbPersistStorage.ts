import {
  createRoomStorePersistence,
  type PersistenceController,
} from '@sqlrooms/room-store';
import type {PersistStorage} from 'zustand/middleware';
type DuckDbLikeConnector = {
  query: (sql: string) => PromiseLike<any>;
};

const UI_STATE_KEY = 'default';
const PERSIST_DEBOUNCE_MS = 300;

/** DuckDB persistence with an explicit successful-restoration boundary. */
export type DuckDbPersistStorage<TPersisted> = PersistStorage<TPersisted> & {
  controller: PersistenceController<string>;
  flush: () => Promise<void>;
  /** Enables writes and schedules any changes retained by a successful restore. */
  completeHydration: (state: TPersisted) => void;
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

/**
 * Creates debounced workspace storage that blocks writes until the caller
 * completes validation, merging, and post-load synchronization successfully.
 */
export function createDuckDbPersistStorage<TPersisted>(
  connector: DuckDbLikeConnector,
  options?: {namespace?: string},
): DuckDbPersistStorage<TPersisted> {
  const namespace = options?.namespace || '__sqlrooms';
  let ensured: Promise<void> | null = null;
  let handlersRegistered = false;
  // Loading the JSON is not enough: slice validation and merge must succeed
  // before runtime changes are allowed to replace the saved workspace.
  let hydrated = false;
  const ensure = () => {
    ensured = ensured ?? ensureUiStateTable(connector, namespace);
    return ensured;
  };
  const persistence = createRoomStorePersistence<
    TPersisted,
    TPersisted,
    string
  >({
    partialize: (state) => state,
    serialize: (state) => JSON.stringify(state),
    deserialize: (snapshot) => {
      try {
        return JSON.parse(snapshot) as TPersisted;
      } catch {
        return snapshot as TPersisted;
      }
    },
    autosaveDelayMs: PERSIST_DEBOUNCE_MS,
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
  });
  const registerFlushHandlers = () => {
    if (handlersRegistered || typeof window === 'undefined') return;
    handlersRegistered = true;
    const flushNow = () => {
      void persistence.flush('final-flush');
    };
    window.addEventListener('beforeunload', flushNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushNow();
      }
    });
  };

  return {
    ...persistence.storage,
    controller: persistence.controller,
    flush: persistence.flush,
    completeHydration: (state) => {
      // Keep the loaded snapshot as the saved baseline. Startup changes and
      // migrations must reach DuckDB before they can be considered saved.
      persistence.controller.setSnapshot(JSON.stringify(state), 'hydrate');
      hydrated = true;
      registerFlushHandlers();
    },

    getItem: async (...args) => {
      hydrated = false;
      return persistence.storage.getItem(...args);
    },

    setItem: async (...args) => {
      if (!hydrated) return;
      registerFlushHandlers();
      return persistence.storage.setItem(...args);
    },
  };
}
