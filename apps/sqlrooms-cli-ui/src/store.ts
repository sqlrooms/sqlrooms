import {ArtifactsSliceConfig, createArtifactsSlice} from '@sqlrooms/artifacts';
import {
  AiSettingsSliceConfig,
  AiSliceConfig,
  getAiRunContextItems,
  createAiSettingsSlice,
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiToolRenderers,
  createDefaultAiTools,
  type AiRunContext,
  type AiRunContextItem,
} from '@sqlrooms/ai';
import {CanvasSliceConfig, createCanvasSlice} from '@sqlrooms/canvas';
import {
  CellsSliceConfig,
  createCellsSlice,
  createDefaultCellRegistry,
} from '@sqlrooms/cells';
import {
  createDeckMapDashboardPanelConfig,
  DECK_MAP_DASHBOARD_PANEL_TYPE,
  deckMapDashboardPanelRenderer,
} from '@sqlrooms/deck';
import {
  createDefaultLoadTableSchemasFilter,
  createWebSocketDuckDbConnector,
  type DataTable,
  QualifiedTableName,
} from '@sqlrooms/duckdb';
import {
  createCrdtSlice,
  createIndexedDbDocStorage,
  createWebSocketSyncConnector,
} from '@sqlrooms/crdt';
import {
  createDefaultMosaicDashboardPanelRenderers,
  createMosaicDashboardProfilerPanelConfig,
  createMosaicDashboardSlice,
  createMosaicSlice,
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  type MosaicDashboardAddPanelAction,
  MosaicDashboardSliceConfig,
  createDefaultChartTypes,
} from '@sqlrooms/mosaic';
import {createNotebookSlice, NotebookSliceConfig} from '@sqlrooms/notebook';
import {
  BaseRoomConfig,
  createPersistHelpers,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  persistSliceConfigs,
  registerCommandsForOwner,
  unregisterCommandsForOwner,
} from '@sqlrooms/room-shell';
import {createSqlEditorSlice, SqlEditorSliceConfig} from '@sqlrooms/sql-editor';
import {createVegaChartTool, VegaChartToolResult} from '@sqlrooms/vega';
import {
  createWebContainerSlice,
  createWebContainerToolkit,
  WebContainerPersistConfig,
} from '@sqlrooms/webcontainer';
import {produce} from 'immer';
import {MapIcon} from 'lucide-react';

import {createHttpDbBridge} from '@sqlrooms/db';
import {
  createDbSettingsSlice,
  syncConnectionsToDb,
} from '@sqlrooms/db-settings';
import {
  createDocumentCommands,
  createDocumentsSlice,
  DOCUMENT_AI_INSTRUCTIONS,
  DocumentsSliceConfig,
} from '@sqlrooms/documents';
import {createDocumentsCrdtMirror} from '@sqlrooms/documents/crdt';
import {ARTIFACT_TYPES} from './artifactTypes';
import {
  createDashboardAiTools,
  getDashboardAiInstructions,
} from './createDashboardAiTools';
import {
  createDashboardCommands,
  DASHBOARD_COMMAND_OWNER,
} from './createDashboardCommands';
import {getDefaultScaffoldTree} from './helpers';
import {createLayout} from './layout';
import {fetchRuntimeConfig} from './runtimeConfig';
import {createDuckDbPersistStorage, uploadFileToServer} from './serverApi';
import {
  AppBuilderProjectConfig,
  AppBuilderProjectConfigSchema,
  RoomState,
} from './store-types';

export type {RoomState} from './store-types';

const DOCUMENT_COMMAND_OWNER = '@sqlrooms/documents';

export const runtimeConfig = await fetchRuntimeConfig();
const runtimeAiProviders =
  (runtimeConfig.aiProviders as AiSettingsSliceConfig['providers']) || {};
const defaultProviderFromConfig =
  runtimeConfig.llmProvider || Object.keys(runtimeAiProviders)[0] || 'openai';
const defaultModelFromProvider =
  runtimeAiProviders[defaultProviderFromConfig]?.models?.[0]?.modelName;
const defaultModelFromConfig =
  runtimeConfig.llmModel || defaultModelFromProvider || 'gpt-4o-mini';
const MOSAIC_PREAGG_DATABASE = '__sqlrooms_mosaic_cache';
const MOSAIC_PREAGG_SCHEMA = 'mosaic';
const MOSAIC_PREAGG_SCHEMA_REF = `${MOSAIC_PREAGG_DATABASE}.${MOSAIC_PREAGG_SCHEMA}`;
const CRDT_STORAGE_KEY = [
  'sqlrooms-cli',
  runtimeConfig.metaNamespace || '__sqlrooms',
  runtimeConfig.dbPath || 'memory',
  'documents',
].join(':');

function createCliCrdtSyncConnector() {
  if (!runtimeConfig.syncEnabled) return undefined;
  return createWebSocketSyncConnector({
    url:
      runtimeConfig.crdtWsUrl || runtimeConfig.wsUrl || 'ws://localhost:4000',
    roomId:
      runtimeConfig.crdtRoomId ||
      `sqlrooms-cli:${runtimeConfig.metaNamespace || '__sqlrooms'}:${runtimeConfig.dbPath || 'memory'}`,
    sendSnapshotOnConnect: false,
  });
}

const connector = createWebSocketDuckDbConnector({
  wsUrl: runtimeConfig.wsUrl || 'ws://localhost:4000',
  initializationQuery: [
    'INSTALL spatial',
    'LOAD spatial',
    `ATTACH IF NOT EXISTS ':memory:' AS ${MOSAIC_PREAGG_DATABASE}`,
    `CREATE SCHEMA IF NOT EXISTS ${MOSAIC_PREAGG_SCHEMA_REF}`,
  ].join('; '),
});

const baseLoadFile = connector.loadFile.bind(connector);
connector.loadFile = async (file, desiredTableName, options) => {
  if (file instanceof File) {
    const serverPath = await uploadFileToServer(file, runtimeConfig);
    const renamedFile = new File([file], serverPath, {type: file.type});
    return baseLoadFile(renamedFile, desiredTableName, options);
  }
  return baseLoadFile(file, desiredTableName, options);
};

function getRuntimeBridgeConfig() {
  if (runtimeConfig.dbBridge?.connections?.length) {
    return runtimeConfig.dbBridge;
  }
  return undefined;
}

const LONGITUDE_COLUMN_NAMES = ['longitude', 'lon', 'lng', 'long', 'x'];
const LATITUDE_COLUMN_NAMES = ['latitude', 'lat', 'y'];

function findColumnByName(table: DataTable, candidates: string[]) {
  const candidateSet = new Set(candidates);
  return table.columns.find((column) =>
    candidateSet.has(column.name.toLowerCase()),
  )?.name;
}

function findLongitudeLatitudeColumns(table?: DataTable) {
  if (!table) return null;
  const longitudeColumn = findColumnByName(table, LONGITUDE_COLUMN_NAMES);
  const latitudeColumn = findColumnByName(table, LATITUDE_COLUMN_NAMES);
  return longitudeColumn && latitudeColumn
    ? {longitudeColumn, latitudeColumn}
    : null;
}

function quoteSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteTableReference(table: DataTable) {
  const qualifiedName = table.table;
  return [qualifiedName.database, qualifiedName.schema, qualifiedName.table]
    .filter((part): part is string => Boolean(part))
    .map(quoteSqlIdentifier)
    .join('.');
}

function createDeckMapPanelForTable(table: DataTable) {
  const coordinates = findLongitudeLatitudeColumns(table);
  if (!coordinates) return undefined;

  const {longitudeColumn, latitudeColumn} = coordinates;
  const datasetId = table.tableName;
  const geometryColumn = '__sqlrooms_geom';
  const quotedLongitude = quoteSqlIdentifier(longitudeColumn);
  const quotedLatitude = quoteSqlIdentifier(latitudeColumn);

  return createDeckMapDashboardPanelConfig({
    title: `${table.tableName} map`,
    source: {tableName: table.tableName},
    spec: {
      initialViewState: {longitude: 0, latitude: 20, zoom: 1.5},
      layers: [
        {
          '@@type': 'GeoArrowScatterplotLayer',
          id: datasetId,
          _sqlroomsBinding: {dataset: datasetId},
          filled: true,
          stroked: false,
          pickable: true,
          radiusUnits: 'pixels',
          getRadius: 4,
          getFillColor: [56, 189, 248, 180],
        },
      ],
    },
    datasets: {
      [datasetId]: {
        source: {
          sqlQuery: [
            `SELECT *, ST_AsWKB(ST_Point(${quotedLongitude}, ${quotedLatitude})) AS ${quoteSqlIdentifier(geometryColumn)}`,
            `FROM ${quoteTableReference(table)}`,
            `WHERE ${quotedLongitude} IS NOT NULL AND ${quotedLatitude} IS NOT NULL`,
          ].join(' '),
        },
        geometryColumn,
        geometryEncodingHint: 'wkb',
      },
    },
    fitToData: {
      dataset: datasetId,
      longitudeColumn,
      latitudeColumn,
      padding: 40,
      maxZoom: 12,
    },
  });
}

const deckMapDashboardAddPanelAction: MosaicDashboardAddPanelAction = {
  type: DECK_MAP_DASHBOARD_PANEL_TYPE,
  label: 'Map',
  icon: MapIcon,
  isEnabled: ({selectedTable}) =>
    Boolean(findLongitudeLatitudeColumns(selectedTable)),
  createPanel: ({selectedTable}) =>
    selectedTable ? createDeckMapPanelForTable(selectedTable) : undefined,
};

const sliceConfigSchemas = {
  room: BaseRoomConfig,
  layout: LayoutConfig,
  ai: AiSliceConfig,
  aiSettings: AiSettingsSliceConfig,
  sqlEditor: SqlEditorSliceConfig,
  artifacts: ArtifactsSliceConfig,
  cells: CellsSliceConfig,
  notebook: NotebookSliceConfig,
  canvas: CanvasSliceConfig,
  documents: DocumentsSliceConfig,
  webContainer: WebContainerPersistConfig,
  appProject: AppBuilderProjectConfigSchema,
  mosaicDashboard: MosaicDashboardSliceConfig,
} as const;

const persistHelpers = createPersistHelpers(sliceConfigSchemas);

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs<RoomState>(
    {
      name: 'sqlrooms-cli-app-state',
      sliceConfigSchemas,
      storage: createDuckDbPersistStorage(connector, {
        namespace: runtimeConfig.metaNamespace || '__sqlrooms',
      }),
      merge: (persistedState, currentState) => {
        const persistedRecord = (persistedState ?? {}) as Record<
          string,
          unknown
        >;
        const persistedCells = CellsSliceConfig.parse(
          persistedRecord.cells ?? currentState.cells.config,
        );
        const persistedArtifacts = ArtifactsSliceConfig.parse(
          persistedRecord.artifacts ?? currentState.artifacts.config,
        );

        return persistHelpers.merge(
          {
            ...persistedRecord,
            artifacts: persistedArtifacts,
            cells: persistedCells,
          },
          currentState,
        );
      },
    },
    (set, get, store) => {
      const getFirstDashboardArtifactId = () =>
        Object.values(get().artifacts.config.artifactsById).find(
          (artifact) => artifact.type === 'dashboard',
        )?.id;
      const getRunContextDashboardArtifactId = () => {
        const currentSession = get().ai.getCurrentSession();
        const contextItems = getAiRunContextItems(currentSession?.runContext);
        return contextItems.find((item) => {
          const artifact = get().artifacts.config.artifactsById[item.id];
          return artifact?.type === 'dashboard';
        })?.id;
      };

      const dashboardSlice: RoomState['dashboard'] = {
        initialize: async () => {
          registerCommandsForOwner(
            store,
            DASHBOARD_COMMAND_OWNER,
            createDashboardCommands(),
          );
          registerCommandsForOwner(
            store,
            DOCUMENT_COMMAND_OWNER,
            createDocumentCommands<RoomState>(),
          );
        },
        destroy: async () => {
          unregisterCommandsForOwner(store, DASHBOARD_COMMAND_OWNER);
          unregisterCommandsForOwner(store, DOCUMENT_COMMAND_OWNER);
        },
        ensureDashboardArtifact: (artifactId) => {
          const artifact = get().artifacts.getArtifact(artifactId);
          if (!artifact || artifact.type !== 'dashboard') {
            return;
          }
          get().mosaicDashboard.ensureDashboard(artifactId, artifact.title);
        },
        addProfilerForTable: (tableName) => {
          const existingDashboardArtifactId =
            get().dashboard.getCurrentDashboardArtifactId();
          const artifactId =
            existingDashboardArtifactId ??
            get().dashboard.createDashboardArtifact('Dashboard', 'grid');
          if (!existingDashboardArtifactId) {
            get().artifacts.setCurrentArtifact(artifactId);
          }
          get().dashboard.ensureDashboardArtifact(artifactId);
          const dashboard = get().mosaicDashboard.getDashboard(artifactId);
          if (!dashboard) return artifactId;

          if (!dashboard.selectedTable) {
            get().mosaicDashboard.setSelectedTable(artifactId, tableName);
          }

          const hasProfilerForTable = dashboard.panels.some(
            (panel) =>
              panel.type === MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE &&
              panel.source?.tableName === tableName,
          );
          if (!hasProfilerForTable) {
            get().mosaicDashboard.addPanel(
              artifactId,
              createMosaicDashboardProfilerPanelConfig({
                title: `${tableName} profiler`,
                source: {tableName},
              }),
            );
          }

          return artifactId;
        },
        getCurrentDashboardArtifactId: () => {
          const contextDashboardArtifactId = getRunContextDashboardArtifactId();
          if (contextDashboardArtifactId) {
            return contextDashboardArtifactId;
          }
          const currentArtifactId = get().artifacts.config.currentArtifactId;
          const currentArtifact = currentArtifactId
            ? get().artifacts.config.artifactsById[currentArtifactId]
            : undefined;
          if (currentArtifact?.type === 'dashboard') {
            return currentArtifactId;
          }
          return getFirstDashboardArtifactId();
        },
        createDashboardArtifact: (title, layoutType = 'grid') => {
          const artifactId = get().artifacts.createArtifact({
            type: 'dashboard',
            title: title ?? 'Dashboard',
          });
          get().mosaicDashboard.ensureDashboard(
            artifactId,
            title ?? 'Dashboard',
            layoutType,
          );
          return artifactId;
        },
      };

      return {
        appProject: {
          config: AppBuilderProjectConfig.parse({}),
          upsertArtifactApp: (artifactId, app) => {
            set((state) =>
              produce(state, (draft: RoomState) => {
                const current = draft.appProject.config.appsByArtifactId[
                  artifactId
                ] ?? {
                  name: app.name,
                  prompt: '',
                  template: 'mosaic-dashboard',
                  files: {},
                  updatedAt: 0,
                };
                draft.appProject.config.appsByArtifactId[artifactId] = {
                  ...current,
                  ...app,
                  updatedAt: Date.now(),
                };
              }),
            );
          },
          updateArtifactAppFiles: (artifactId, files) => {
            set((state) =>
              produce(state, (draft) => {
                const current =
                  draft.appProject.config.appsByArtifactId[artifactId];
                if (!current) return;
                draft.appProject.config.appsByArtifactId[artifactId] = {
                  ...current,
                  files,
                  updatedAt: Date.now(),
                };
              }),
            );
          },
          removeArtifactApp: (artifactId) => {
            set((state) =>
              produce(state, (draft) => {
                delete draft.appProject.config.appsByArtifactId[artifactId];
              }),
            );
          },
          getArtifactApp: (artifactId) =>
            get().appProject.config.appsByArtifactId[artifactId],
        },
        dashboard: dashboardSlice,

        ...createDbSettingsSlice({
          config: {
            connections: (runtimeConfig.dbBridge?.connections ?? []).map(
              (c) => ({
                id: c.id,
                engineId: c.engineId,
                title: c.title || c.id,
                runtimeSupport: c.runtimeSupport || 'server',
                requiresBridge: c.requiresBridge ?? true,
                bridgeId: c.bridgeId,
                isCore: c.isCore ?? false,
                config: c.config,
              }),
            ),
            diagnostics: runtimeConfig.dbBridge?.diagnostics ?? [],
            supportedEngines: runtimeConfig.dbBridge?.supportedEngines ?? [],
            engineConfigFields:
              runtimeConfig.dbBridge?.engineConfigFields ?? {},
          },
        })(set, get, store),

        ...createRoomShellSlice({
          connector,
          config: {dataSources: []},
          layout: createLayout({store}),
          createDbProps: {
            duckDb: {
              loadTableSchemasFilter: (() => {
                const filter = createDefaultLoadTableSchemasFilter();
                return (table: QualifiedTableName) => {
                  return (
                    filter(table) &&
                    !(
                      table.database === get().db.currentDatabase &&
                      table.schema === 'mosaic'
                    )
                  );
                };
              })(),
            },
          },
        })(set, get, store),

        ...createArtifactsSlice<RoomState>({
          artifactTypes: ARTIFACT_TYPES,
        })(set, get, store),

        ...createMosaicSlice({
          preagg: {
            schema: MOSAIC_PREAGG_SCHEMA_REF,
          },
        })(set, get, store),

        ...createMosaicDashboardSlice({
          addPanelActions: [deckMapDashboardAddPanelAction],
          panelRenderers: createDefaultMosaicDashboardPanelRenderers({
            [DECK_MAP_DASHBOARD_PANEL_TYPE]: deckMapDashboardPanelRenderer,
          }),
          chartTypes: createDefaultChartTypes(),
        })(set, get, store),

        ...createSqlEditorSlice()(set, get, store),

        ...createCellsSlice({
          cellRegistry: createDefaultCellRegistry(),
        })(set, get, store),

        ...createNotebookSlice()(set, get, store),

        ...createCanvasSlice()(set, get, store),

        ...createDocumentsSlice()(set, get, store),

        ...createCrdtSlice<RoomState>({
          storage: createIndexedDbDocStorage({key: CRDT_STORAGE_KEY}),
          sync: createCliCrdtSyncConnector(),
          mirrors: {
            documentState: createDocumentsCrdtMirror<RoomState>(),
          },
        })(set, get, store),

        ...createWebContainerSlice({
          autoInitialize: false,
          config: {
            filesTree: getDefaultScaffoldTree(),
            activeFilePath: '/src/App.jsx',
          },
        })(set, get, store),

        ...createAiSettingsSlice({
          config: {providers: runtimeAiProviders},
        })(set, get, store),

        ...(() => {
          const webContainerToolkit = createWebContainerToolkit(store);
          return createAiSlice({
            config: AiSliceConfig.parse({sessions: []}),
            defaultProvider: defaultProviderFromConfig as any,
            defaultModel: defaultModelFromConfig,
            getApiKey: (provider) =>
              get().aiSettings.config.providers[provider]?.apiKey ||
              runtimeConfig.apiKey ||
              '',
            getBaseUrl: () => runtimeConfig.apiBaseUrl || '',
            getInstructions: () =>
              `${createDefaultAiInstructions(store)}\n\n${getDashboardAiInstructions(store)}\n\n${DOCUMENT_AI_INSTRUCTIONS}`,
            getRunContext: () => {
              const state = store.getState();
              const {artifactsById} = state.artifacts.config;
              const items = Array.from(new Set(state.aiContextItemIds))
                .map((artifactId): AiRunContextItem | undefined => {
                  const artifact = artifactsById[artifactId];
                  if (!artifact) return undefined;
                  return {
                    kind: 'artifact',
                    id: artifact.id,
                    type: artifact.type,
                    title: artifact.title,
                  };
                })
                .filter(Boolean) as AiRunContextItem[];
              if (items.length === 0) return undefined;
              return {
                items,
                capturedAt: Date.now(),
              } satisfies AiRunContext;
            },
            formatRunContextInstructions: ({runContext}) => {
              const artifactItems = getAiRunContextItems(runContext).filter(
                (item) => item.kind === 'artifact',
              );
              if (artifactItems.length === 0) return '';
              const [mainItem, ...additionalItems] = artifactItems;
              if (!mainItem) return '';
              const artifactType = mainItem.type ?? 'artifact';
              return [
                'Current artifact context:',
                `- Main/default target: ${artifactType} "${mainItem.title}" (id: ${mainItem.id}). Tools use this artifact as the implicit target when the artifact type is supported.`,
                ...additionalItems.map(
                  (item) =>
                    `- Additional reference context: ${item.type ?? 'artifact'} "${item.title}" (id: ${item.id}).`,
                ),
                '- Additional context items are reference-only by default; tools will not implicitly target them.',
              ].join('\n');
            },
            tools: {
              ...createDefaultAiTools(store, {query: {}}),
              ...createDashboardAiTools(store),
              ...webContainerToolkit.tools,
              chart: createVegaChartTool(),
            },
            toolRenderers: {
              ...createDefaultAiToolRenderers(),
              ...webContainerToolkit.toolRenderers,
              chart: VegaChartToolResult,
            },
          })(set, get, store);
        })(),
        aiContextMode: 'auto',
        aiContextItemIds: [],
        setAiContextItemIds: (artifactIds, mode) => {
          set({
            aiContextItemIds: Array.from(new Set(artifactIds)),
            ...(mode ? {aiContextMode: mode} : {}),
          });
        },
        replaceAiContextWithArtifact: (artifactId) => {
          set({aiContextItemIds: [artifactId]});
        },
      };
    },
  ),
);

const bridgeConfig = getRuntimeBridgeConfig();
if (bridgeConfig) {
  const bridge = createHttpDbBridge({
    id: bridgeConfig.id,
    baseUrl: runtimeConfig.apiBaseUrl || '',
  });
  roomStore.getState().db.connectors.registerBridge(bridge);
}
syncConnectionsToDb(roomStore);
