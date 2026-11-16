import type {DbConnection, DbSliceState} from '@sqlrooms/db';
import {
  createSlice,
  useBaseRoomStore,
  type StateCreator,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {DbSettingsSliceConfig} from './DbSettingsSliceConfig';

function connectionsSnapshot(connections: DbConnection[]): string {
  return JSON.stringify(
    connections
      .filter((c) => !c.isCore)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(
        ({
          id,
          engineId,
          title,
          runtimeSupport,
          requiresBridge,
          bridgeId,
          config,
        }) => ({
          id,
          engineId,
          title,
          runtimeSupport,
          requiresBridge,
          bridgeId,
          config: config
            ? Object.fromEntries(
                Object.entries(config).sort(([a], [b]) => a.localeCompare(b)),
              )
            : undefined,
        }),
      ),
  );
}

/** Editing options and server persistence for the canonical database definitions. */
export type DbSettingsSliceState = {
  dbSettings: {
    config: DbSettingsSliceConfig;
    isSaving: boolean;
    /** Compare canonical definitions with the last successful save or initial state. */
    hasUnsavedChanges: () => boolean;
    lastSaveError: string | null;
    setConfig: (config: DbSettingsSliceConfig) => void;
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
  /** Host transport for settings saves and connection tests; defaults to browser fetch. */
  fetch?: (url: string, init?: RequestInit) => Promise<Response>;
};

function createDefaultDbSettingsConfig(
  overrides?: Partial<DbSettingsSliceConfig>,
): DbSettingsSliceConfig {
  return DbSettingsSliceConfig.parse(overrides ?? {});
}

/** Create editable database settings with an optional host-provided HTTP transport. */
export function createDbSettingsSlice(
  props?: CreateDbSettingsSliceParams,
): StateCreator<DbSettingsSliceState> {
  const config = createDefaultDbSettingsConfig(props?.config);
  return createSlice<DbSettingsSliceState, DbStateWithSettings>(
    (set, get, store) => {
      // The composed initial state is only available after all slice creators run.
      // Keep a persistence baseline, never a second editable connection registry.
      let savedSnapshot: string | undefined;
      const hasUnsavedChanges = () => {
        savedSnapshot ??= connectionsSnapshot(
          Object.values(store.getInitialState().db.config.connections),
        );
        return (
          connectionsSnapshot(Object.values(get().db.config.connections)) !==
          savedSnapshot
        );
      };

      return {
        dbSettings: {
          config,
          isSaving: false,
          hasUnsavedChanges,
          lastSaveError: null,

          setConfig: (config) => {
            set((state) =>
              produce(state, (draft) => {
                draft.dbSettings.config = config;
              }),
            );
          },

          saveToServer: async (apiBaseUrl = '') => {
            // A second save must not overwrite the baseline of an in-flight request.
            if (get().dbSettings.isSaving) return false;
            set((state) =>
              produce(state, (draft) => {
                draft.dbSettings.isSaving = true;
                draft.dbSettings.lastSaveError = null;
              }),
            );

            try {
              const connections = Object.values(
                get().db.config.connections,
              ).filter((connection) => !connection.isCore);
              const res = await (props?.fetch ?? fetch)(
                `${apiBaseUrl}/api/db/settings`,
                {
                  method: 'PUT',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({connections}),
                },
              );
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
                  savedSnapshot = connectionsSnapshot(connections);
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
              const res = await (props?.fetch ?? fetch)(
                `${apiBaseUrl}/api/db/test-connection`,
                {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({engine, config}),
                },
              );
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
      };
    },
  );
}

type DbStateWithSettings = DbSliceState & DbSettingsSliceState;

/**
 * Typed selector hook for stores that include both DbSlice and DbSettingsSlice.
 */
export function useStoreWithDbSettings<T>(
  selector: (state: DbStateWithSettings) => T,
): T {
  return useBaseRoomStore<DbStateWithSettings, T>(selector);
}
