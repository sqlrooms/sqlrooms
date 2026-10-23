import {
  createRoomStore,
  persistSliceConfigs,
  registerCommandsForOwner,
} from '@sqlrooms/room-store';
import {
  createRoomShellSlice,
  createDuckDbPersistStorage,
} from '@sqlrooms/room-shell';
import {
  createMosaicSlice,
  createDefaultChartTypes,
  createDefaultMosaicDashboardPanelRenderers,
  defaultAddPanelActions,
} from '@sqlrooms/mosaic';
import {createWebSocketDuckDbConnector} from '@sqlrooms/duckdb';
import type {RoomState} from './RoomState';
import {createRoomieDomainSlice} from './createRoomieDomainSlice';
import {pageCredential, authorizedFetch} from './auth';
import {config} from './config';
import {contentSchemas, selectRoomieContent} from './stateOwnership';
import {mergeRoomieContent, parseContentWorkspace} from './contentPersistence';
import {initializeBrowserViewState} from './browserViewState';
import {createRoomieSaveStatus} from './saveStatus';
import {createRoomieCommands} from './commands';
import {validateTableFilters} from './tableSelection';
import {
  isRoomieRenderTable,
  validateWorkspaceRenderSources,
} from './renderSources';

export const connector = createWebSocketDuckDbConnector({
  wsUrl: config.wsUrl,
  authToken: pageCredential(),
  initializationQuery:
    "ATTACH IF NOT EXISTS ':memory:' AS __roomie_cache; CREATE SCHEMA IF NOT EXISTS __roomie_cache.mosaic;",
});
const partialize = (state: RoomState) => ({
  application: 'roomie' as const,
  schemaVersion: 2 as const,
  ...selectRoomieContent(state),
});
let viewStorage:
  | Awaited<ReturnType<typeof initializeBrowserViewState>>
  | undefined;
const contentStorage = createDuckDbPersistStorage<
  ReturnType<typeof partialize>
>(connector, {namespace: '__roomie'});
export const storage = {
  ...contentStorage,
  saveStatus: createRoomieSaveStatus(contentStorage.controller),
  async flush() {
    await contentStorage.flush();
    await viewStorage?.flush();
  },
};
let resolveHydration: () => void;
let rejectHydration: (error: unknown) => void;
const hydration = new Promise<void>((resolve, reject) => {
  resolveHydration = resolve;
  rejectHydration = reject;
});
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'roomie-workspace',
      sliceConfigSchemas: contentSchemas,
      storage,
      partialize,
      merge: (persisted, current) =>
        persisted == null
          ? current
          : mergeRoomieContent(current, parseContentWorkspace(persisted)),
      onRehydrateStorage: () => (_state, error) =>
        error ? rejectHydration(error) : resolveHydration(),
    },
    (set, get, api) => ({
      ...createRoomShellSlice({
        connector,
        config: {title: 'Roomie', dataSources: []},
        createDbProps: {
          duckDb: {
            loadTableSchemasFilter: isRoomieRenderTable,
            loadSchemaCatalogFilter: (entry) =>
              entry.type === 'database'
                ? !entry.database.startsWith('__')
                : entry.type === 'schema'
                  ? !entry.schema.startsWith('__')
                  : !entry.table.schema?.startsWith('__') &&
                    !entry.table.database?.startsWith('__'),
          },
        },
      })(set, get, api),
      ...createMosaicSlice({preagg: {schema: '__roomie_cache.mosaic'}})(
        set,
        get,
        api,
      ),
      ...createRoomieDomainSlice({
        chartTypes: createDefaultChartTypes({includeCustomSpec: false}),
        addPanelActions: defaultAddPanelActions,
        panelRenderers: createDefaultMosaicDashboardPanelRenderers(),
      })(set, get, api),
    }),
  ),
);

/** Complete initialization and validated hydration before enabling edits and saves. */
let initialization: Promise<void> | undefined;
export function initializeRoomie() {
  return (initialization ??= initializeRoomieOnce());
}

async function initializeRoomieOnce() {
  await hydration;
  await roomStore.getState().room.initialize();
  await roomStore.getState().db.refreshTableSchemas();
  const state = roomStore.getState();
  await validateWorkspaceRenderSources(state);
  viewStorage = await initializeBrowserViewState(
    roomStore,
    config.databasePath,
  );
  storage.saveStatus.setView(viewStorage.controller);
  for (const settings of Object.values(
    roomStore.getState().tableExplorers.config.byId,
  ))
    await validateTableFilters(state.db, settings.filters);
  roomStore.getState().commands.unregisterCommands('@sqlrooms/room-shell');
  roomStore.getState().commands.unregisterCommands('@sqlrooms/layout/panels');
  registerCommandsForOwner(
    roomStore,
    'roomie',
    createRoomieCommands({
      resolveLocalFile: async (input, signal) => {
        const response = await authorizedFetch('/api/local-file', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(input),
          signal,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.message ?? result.error ?? 'Cannot open local file.',
          );
        return result;
      },
    }),
  );
  storage.completeHydration(partialize(roomStore.getState()));
}
