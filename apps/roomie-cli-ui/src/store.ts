import {
  createRoomStore,
  createPersistHelpers,
  persistSliceConfigs,
  registerCommandsForOwner,
} from '@sqlrooms/room-store';
import {
  createRoomShellSlice,
  createDuckDbPersistStorage,
} from '@sqlrooms/room-shell';
import {createArtifactsSlice} from '@sqlrooms/artifacts';
import {createBlockDocumentsSlice} from '@sqlrooms/documents';
import {createHtmlAppRuntimeSlice} from '@sqlrooms/app-runtime';
import {
  createMosaicSlice,
  createDashboardFeatureSlices,
  createDefaultChartTypes,
  createDefaultMosaicDashboardPanelRenderers,
  defaultAddPanelActions,
} from '@sqlrooms/mosaic';
import {createWebSocketDuckDbConnector} from '@sqlrooms/duckdb';
import type {RoomState} from './RoomState';
import {pageCredential, authorizedFetch} from './auth';
import {config} from './config';
import {sliceSchemas, Workspace, TableSettings} from './model';
import {createRoomieCommands, ensureBlock} from './commands';
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
const helpers = createPersistHelpers(sliceSchemas);
const partialize = (state: RoomState) => ({
  application: 'roomie' as const,
  schemaVersion: 1 as const,
  ...helpers.partialize(state),
});
export const storage = createDuckDbPersistStorage<
  ReturnType<typeof partialize>
>(connector, {namespace: '__roomie'});
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
      sliceConfigSchemas: sliceSchemas,
      storage,
      partialize,
      merge: (persisted, current) =>
        persisted == null
          ? current
          : helpers.merge(Workspace.parse(persisted), current),
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
      ...createArtifactsSlice<RoomState>({
        artifactTypes: {
          'block-document': {
            label: 'Document',
            defaultTitle: 'Untitled document',
            onCreate: ({artifactId}) =>
              get().blockDocuments.ensureBlockDocument(artifactId),
            onDelete: ({artifactId}) =>
              get().blockDocuments.removeBlockDocument(artifactId),
          },
        },
      })(set, get, api),
      ...createBlockDocumentsSlice<RoomState>({
        onCreateOwnedStatefulBlock: ({blockType, blockInstanceId}) =>
          ensureBlock(get(), blockType, blockInstanceId),
        onDeleteOwnedStatefulBlock: ({blockType, blockInstanceId}) => {
          if (blockType === 'dashboard')
            get().mosaicDashboard.removeDashboard(blockInstanceId);
          if (blockType === 'html-app')
            get().htmlApps.removeApp(blockInstanceId);
          if (blockType === 'data-table')
            set((state) => {
              const byId = {...state.tableExplorers.config.byId};
              delete byId[blockInstanceId];
              return {
                tableExplorers: {...state.tableExplorers, config: {byId}},
              };
            });
        },
      })(set, get, api),
      ...createHtmlAppRuntimeSlice()(set, get, api),
      ...createMosaicSlice({preagg: {schema: '__roomie_cache.mosaic'}})(
        set,
        get,
        api,
      ),
      ...createDashboardFeatureSlices({
        chartTypes: createDefaultChartTypes({includeCustomSpec: false}),
        addPanelActions: defaultAddPanelActions,
        panelRenderers: createDefaultMosaicDashboardPanelRenderers(),
      })(set, get, api),
      tableExplorers: {
        config: {byId: {}},
        update: (id, settings) =>
          set((state) => ({
            tableExplorers: {
              ...state.tableExplorers,
              config: {
                byId: {
                  ...state.tableExplorers.config.byId,
                  [id]: TableSettings.parse(settings),
                },
              },
            },
          })),
      },
    }),
  ),
);

/** Complete initialization and validated hydration before enabling edits and saves. */
export async function initializeRoomie() {
  await hydration;
  await roomStore.getState().room.initialize();
  await roomStore.getState().db.refreshTableSchemas();
  const state = roomStore.getState();
  validateWorkspaceRenderSources(state);
  for (const settings of Object.values(state.tableExplorers.config.byId))
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
