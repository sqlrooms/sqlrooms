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

export type DbSettingsSliceState = {
  dbSettings: {
    config: DbSettingsSliceConfig;
    setConfig: (config: DbSettingsSliceConfig) => void;
    upsertConnection: (connection: DbConnection) => void;
    removeConnection: (id: string) => void;
    setDiagnostics: (diagnostics: ConnectorDriverDiagnostic[]) => void;
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
  return createSlice<DbSettingsSliceState>((set) => ({
    dbSettings: {
      config,

      setConfig: (config) => {
        set((state) =>
          produce(state, (draft) => {
            draft.dbSettings.config = config;
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
          }),
        );
      },

      removeConnection: (id) => {
        set((state) =>
          produce(state, (draft) => {
            draft.dbSettings.config.connections =
              draft.dbSettings.config.connections.filter((c) => c.id !== id);
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

  const existingIds = new Set(
    state.db.connectors.listConnections().map((c) => c.id),
  );
  const desiredIds = new Set(connections.map((c) => c.id));

  for (const id of existingIds) {
    if (!desiredIds.has(id)) {
      state.db.connectors.removeConnection(id);
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
