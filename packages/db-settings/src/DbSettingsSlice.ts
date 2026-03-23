import type {DbConnection, DbSliceState} from '@sqlrooms/db';
import {
  createSlice,
  useBaseRoomStore,
  type StateCreator,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {
  ConnectorDriverDiagnostic,
  DbSettingsSliceConfig,
} from './DbSettingsSliceConfig';

function connectionsSnapshot(connections: DbConnection[]): string {
  return JSON.stringify(
    connections
      .filter((c) => !c.isCore)
      .map(({id, engineId, title, bridgeId, config}) => ({
        id,
        engineId,
        title,
        bridgeId,
        config,
      })),
  );
}

export type DbSettingsSliceState = {
  dbSettings: {
    config: DbSettingsSliceConfig;
    isSaving: boolean;
    hasUnsavedChanges: boolean;
    lastSaveError: string | null;
    setConfig: (config: DbSettingsSliceConfig) => void;
    upsertConnection: (connection: DbConnection) => void;
    removeConnection: (id: string) => void;
    setDiagnostics: (diagnostics: ConnectorDriverDiagnostic[]) => void;
    saveToServer: (apiBaseUrl?: string) => Promise<boolean>;
    testConnection: (
      engine: string,
      config: Record<string, string>,
      apiBaseUrl?: string,
    ) => Promise<{ok: boolean; error?: string}>;
  };
};

type CreateDbSettingsSliceParams = {
  config?: Partial<DbSettingsSliceConfig>;
};

function createDefaultDbSettingsConfig(
  overrides?: Partial<DbSettingsSliceConfig>,
): DbSettingsSliceConfig {
  return DbSettingsSliceConfig.parse(overrides ?? {});
}

export function createDbSettingsSlice(
  props?: CreateDbSettingsSliceParams,
): StateCreator<DbSettingsSliceState> {
  const config = createDefaultDbSettingsConfig(props?.config);
  let savedSnapshot = connectionsSnapshot(config.connections);

  const markDirty = (state: DbSettingsSliceState) => {
    const current = connectionsSnapshot(state.dbSettings.config.connections);
    return current !== savedSnapshot;
  };

  return createSlice<DbSettingsSliceState>((set, get) => ({
    dbSettings: {
      config,
      isSaving: false,
      hasUnsavedChanges: false,
      lastSaveError: null,

      setConfig: (config) => {
        set((state) =>
          produce(state, (draft) => {
            draft.dbSettings.config = config;
            draft.dbSettings.hasUnsavedChanges = markDirty(draft);
          }),
        );
      },

      upsertConnection: (connection) => {
        set((state) =>
          produce(state, (draft) => {
            const idx = draft.dbSettings.config.connections.findIndex(
              (c) => c.id === connection.id,
            );
            if (idx >= 0) {
              draft.dbSettings.config.connections[idx] = connection;
            } else {
              draft.dbSettings.config.connections.push(connection);
            }
            draft.dbSettings.hasUnsavedChanges = markDirty(draft);
          }),
        );
      },

      removeConnection: (id) => {
        set((state) =>
          produce(state, (draft) => {
            draft.dbSettings.config.connections =
              draft.dbSettings.config.connections.filter((c) => c.id !== id);
            draft.dbSettings.hasUnsavedChanges = markDirty(draft);
          }),
        );
      },

      setDiagnostics: (diagnostics) => {
        set((state) =>
          produce(state, (draft) => {
            draft.dbSettings.config.diagnostics = diagnostics;
          }),
        );
      },

      saveToServer: async (apiBaseUrl = '') => {
        set((state) =>
          produce(state, (draft) => {
            draft.dbSettings.isSaving = true;
            draft.dbSettings.lastSaveError = null;
          }),
        );

        try {
          const connections = (get() as DbSettingsSliceState).dbSettings.config
            .connections;
          const res = await fetch(`${apiBaseUrl}/api/db/settings`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({connections}),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg =
              (body as {error?: string}).error ??
              `Server returned ${res.status}`;
            throw new Error(msg);
          }
          set((state) =>
            produce(state, (draft) => {
              draft.dbSettings.isSaving = false;
              savedSnapshot = connectionsSnapshot(
                draft.dbSettings.config.connections,
              );
              draft.dbSettings.hasUnsavedChanges = false;
            }),
          );
          return true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          set((state) =>
            produce(state, (draft) => {
              draft.dbSettings.isSaving = false;
              draft.dbSettings.lastSaveError = msg;
            }),
          );
          return false;
        }
      },

      testConnection: async (engine, config, apiBaseUrl = '') => {
        try {
          const res = await fetch(`${apiBaseUrl}/api/db/test-connection`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({engine, config}),
          });
          const body = (await res.json()) as {ok: boolean; error?: string};
          return body;
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },
    },
  }));
}

type DbStateWithSettings = DbSliceState & DbSettingsSliceState;

/**
 * Typed selector hook for stores that include both DbSlice and DbSettingsSlice.
 */
export function useStoreWithDbSettings<T>(
  selector: (state: DbStateWithSettings) => T,
): T {
  return useBaseRoomStore<DbStateWithSettings, T>((state) =>
    selector(state as unknown as DbStateWithSettings),
  );
}

/**
 * Sync connections from dbSettings.config into the DbSlice connection registry.
 *
 * Call after both slices are initialized, and optionally after settings mutations.
 * Only available connections (not flagged unavailable by diagnostics) are registered.
 */
export function syncConnectionsToDb(store: {
  getState: () => DbSliceState & DbSettingsSliceState;
}): void {
  const state = store.getState();
  const {connections, diagnostics} = state.dbSettings.config;

  const diagnosticsKey = (id: string, engineId: string) => `${id}:${engineId}`;
  const diagnosticsByKey = new Map(
    diagnostics.map((d) => [diagnosticsKey(d.id, d.engineId), d]),
  );

  const existingConnections = state.db.connectors.listConnections();
  const desiredIds = new Set(connections.map((c) => c.id));

  for (const existing of existingConnections) {
    if (existing.isCore) continue;
    if (!desiredIds.has(existing.id)) {
      state.db.connectors.removeConnection(existing.id);
    }
  }

  for (const connection of connections) {
    const diag = diagnosticsByKey.get(
      diagnosticsKey(connection.id, connection.engineId),
    );
    if (diag && diag.available === false) {
      continue;
    }
    state.db.connectors.registerConnection(connection);
  }
}
