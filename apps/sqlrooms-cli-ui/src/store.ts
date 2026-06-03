import {ArtifactsSliceConfig, createArtifactsSlice} from '@sqlrooms/artifacts';
import {
  AiSettingsSliceConfig,
  AiSliceConfig,
  getAiRunContextPrimaryItem,
  createAiSettingsSlice,
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiToolRenderers,
  createDefaultAiTools,
} from '@sqlrooms/ai';
import {CanvasSliceConfig, createCanvasSlice} from '@sqlrooms/canvas';
import {
  CellsSliceConfig,
  createCellsSlice,
  createDefaultCellRegistry,
} from '@sqlrooms/cells';
import {createDeckMapDashboardSliceOptions} from '@sqlrooms/deck';
import {
  createDefaultLoadTableSchemasFilter,
  createWebSocketDuckDbConnector,
  defaultLoadSchemaCatalogFilter,
  QualifiedTableName,
  type SchemaCatalogFilterEntry,
} from '@sqlrooms/duckdb';
import {
  CrdtSliceState,
  createCrdtSlice,
  createIndexedDbDocStorage,
  createWebSocketSyncConnector,
} from '@sqlrooms/crdt';
import {
  createMosaicDashboardDataTableExplorerPanelConfig,
  createMosaicDashboardSlice,
  createMosaicSlice,
  MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE,
  MosaicDashboardSliceConfig,
} from '@sqlrooms/mosaic';
import {createNotebookSlice, NotebookSliceConfig} from '@sqlrooms/notebook';
import {createPivotSlice, PivotSliceConfig} from '@sqlrooms/pivot';
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
import {
  createChartImageForMarkdownTool,
  createVegaChartTool,
  VegaChartToolResult,
} from '@sqlrooms/vega';
import {
  createWebContainerSlice,
  createWebContainerToolkit,
  WebContainerPersistConfig,
} from '@sqlrooms/webcontainer';
import {produce} from 'immer';

import {createHttpDbBridge} from '@sqlrooms/db';
import {
  createDbSettingsSlice,
  syncConnectionsToDb,
} from '@sqlrooms/db-settings';
import {
  createBlockDocumentAiInstructions,
  BlockDocumentsSliceConfig,
  createBlockDocumentCommands,
  createBlockDocumentAuthoringInstructions,
  createBlockDocumentsSlice,
  createDocumentCommands,
  createDocumentsSlice,
  DOCUMENT_AI_INSTRUCTIONS,
  DocumentsSliceConfig,
} from '@sqlrooms/documents';
import {createDocumentsCrdtMirror} from '@sqlrooms/documents/crdt';
import {toast} from '@sqlrooms/ui';
import {ARTIFACT_TYPES} from './artifactTypes';
import {
  createDashboardAiTools,
  getDashboardAiInstructions,
} from './createDashboardAiTools';
import {dashboardAgentTool} from './createDashboardAgent';
import {createArtifactContextAiTools} from './context/createArtifactContextAiTools';
import {formatRunContextInstructions} from './context/formatRunContextInstructions';
import {getRunContext} from './context/getRunContext';
import {
  createDashboardCommands,
  DASHBOARD_COMMAND_OWNER,
} from './createDashboardCommands';
import {getDefaultScaffoldTree} from './helpers';
import {createLayout} from './layout';
import {fetchRuntimeConfig} from './runtimeConfig';
import {
  createDuckDbPersistStorage,
  saveAiSettingsToServer,
  uploadFileToServer,
} from './serverApi';
import {
  AppBuilderProjectConfig,
  AppBuilderProjectConfigSchema,
  RoomState,
} from './store-types';
import {
  createStatefulBlockCommandTypes,
  getStatefulBlockArtifactConfig,
  isStatefulBlockArtifactType,
} from './statefulBlockArtifactConfigs';

export type {RoomState} from './store-types';

const DOCUMENT_COMMAND_OWNER = '@sqlrooms/documents';
const WORKSHEET_COMMAND_OWNER = '@sqlrooms/documents/worksheet';
const AI_SETTINGS_SAVE_FAILED_TOAST_ID = 'ai-settings-save-failed';
const WORKSHEET_BLOCK_DOCUMENT_OPTIONS = {
  artifactType: 'worksheet',
  artifactLabel: 'Worksheet',
  commandNamespace: 'worksheet',
  commandGroup: 'Worksheet',
  defaultTitle: 'Worksheet',
  blockDocumentAgentToolName: 'worksheet_agent',
} as const;

export const runtimeConfig = await fetchRuntimeConfig();
const runtimeAiSettings = runtimeConfig.aiSettings || {};
const runtimeAiProviders =
  (runtimeAiSettings.providers as AiSettingsSliceConfig['providers']) ||
  (runtimeConfig.aiProviders as AiSettingsSliceConfig['providers']) ||
  {};
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
const AI_SETTINGS_TOML_SAVE_DEBOUNCE_MS = 500;

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

function createDisabledCrdtState(): CrdtSliceState {
  return {
    crdt: {
      status: 'idle',
      connectionStatus: 'idle',
      setConnectionStatus: () => {},
      initialize: async () => {},
      destroy: async () => {},
    },
  };
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
  blockDocuments: BlockDocumentsSliceConfig,
  webContainer: WebContainerPersistConfig,
  appProject: AppBuilderProjectConfigSchema,
  mosaicDashboard: MosaicDashboardSliceConfig,
  pivot: PivotSliceConfig,
} as const;

const persistHelpers = createPersistHelpers(sliceConfigSchemas);
const cliUiPersistStorage = createDuckDbPersistStorage(connector, {
  namespace: runtimeConfig.metaNamespace || '__sqlrooms',
});
export const uiStatePersistenceController = cliUiPersistStorage.controller;

function getAvailableAiModels(config: AiSettingsSliceConfig) {
  return [
    ...Object.entries(config.providers).flatMap(([provider, providerConfig]) =>
      providerConfig.models.map((model) => ({
        provider,
        value: model.modelName,
      })),
    ),
    ...config.customModels.map((model) => ({
      provider: 'custom',
      value: model.modelName,
    })),
  ];
}

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs<RoomState>(
    {
      name: 'sqlrooms-cli-app-state',
      sliceConfigSchemas,
      storage: cliUiPersistStorage,
      partialize: persistHelpers.partialize,
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
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        cliUiPersistStorage.setBaselineFromState(
          persistHelpers.partialize(state),
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
        const primaryItem = getAiRunContextPrimaryItem(
          currentSession?.runContext,
        );
        if (!primaryItem) return undefined;
        const artifact = get().artifacts.config.artifactsById[primaryItem.id];
        return artifact?.type === 'dashboard' ? primaryItem.id : undefined;
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
          registerCommandsForOwner(
            store,
            WORKSHEET_COMMAND_OWNER,
            createBlockDocumentCommands<RoomState>({
              ...WORKSHEET_BLOCK_DOCUMENT_OPTIONS,
              statefulBlockTypes: createStatefulBlockCommandTypes(),
            }),
          );
        },
        destroy: async () => {
          unregisterCommandsForOwner(store, DASHBOARD_COMMAND_OWNER);
          unregisterCommandsForOwner(store, DOCUMENT_COMMAND_OWNER);
          unregisterCommandsForOwner(store, WORKSHEET_COMMAND_OWNER);
        },
        ensureDashboardArtifact: (artifactId) => {
          const artifact = get().artifacts.getArtifact(artifactId);
          if (!artifact || artifact.type !== 'dashboard') {
            return;
          }
          get().mosaicDashboard.ensureDashboard(artifactId, artifact.title);
        },
        addDataTableExplorerForTable: (tableName) => {
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

          const hasDataTableExplorerForTable = dashboard.panels.some(
            (panel) =>
              panel.type === MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE,
          );

          if (!hasDataTableExplorerForTable) {
            get().mosaicDashboard.addPanel(
              artifactId,
              createMosaicDashboardDataTableExplorerPanelConfig({
                title: `${tableName} explorer`,
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
              loadSchemaCatalogFilter: (entry: SchemaCatalogFilterEntry) => {
                if (!defaultLoadSchemaCatalogFilter(entry)) {
                  return false;
                }
                if (
                  entry.type === 'schema' &&
                  entry.database === get().db.currentDatabase &&
                  entry.schema === 'mosaic'
                ) {
                  return false;
                }
                if (
                  entry.type === 'table' &&
                  entry.table.database === get().db.currentDatabase &&
                  entry.table.schema === 'mosaic'
                ) {
                  return false;
                }
                return true;
              },
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

        ...createMosaicDashboardSlice(createDeckMapDashboardSliceOptions())(
          set,
          get,
          store,
        ),

        ...createSqlEditorSlice()(set, get, store),

        ...createCellsSlice({
          cellRegistry: createDefaultCellRegistry(),
        })(set, get, store),

        ...createNotebookSlice()(set, get, store),

        ...createPivotSlice()(set, get, store),

        ...createCanvasSlice()(set, get, store),

        ...createDocumentsSlice()(set, get, store),

        ...createBlockDocumentsSlice<RoomState>({
          onCreateOwnedStatefulBlock: ({
            blockInstanceId,
            blockType,
            getState,
            title,
          }) => {
            if (!isStatefulBlockArtifactType(blockType)) {
              console.warn('Unknown stateful block type on create', {
                blockType,
                blockInstanceId,
                title,
              });
              return;
            }
            const config = getStatefulBlockArtifactConfig(blockType);
            config.ensureState(
              getState(),
              blockInstanceId,
              title ?? config.embeddedTitle,
            );
          },
          onDeleteOwnedStatefulBlock: ({
            blockInstanceId,
            blockType,
            getState,
          }) => {
            if (!isStatefulBlockArtifactType(blockType)) {
              console.warn('Unknown stateful block type on delete', {
                blockType,
                blockInstanceId,
              });
              return;
            }
            const config = getStatefulBlockArtifactConfig(blockType);
            config.deleteState(getState(), blockInstanceId);
          },
          onRenameOwnedStatefulBlock: ({
            blockInstanceId,
            blockType,
            getState,
            title,
          }) => {
            if (!isStatefulBlockArtifactType(blockType)) {
              console.warn('Unknown stateful block type on rename', {
                blockType,
                blockInstanceId,
                title,
              });
              return;
            }
            const config = getStatefulBlockArtifactConfig(blockType);
            if (config.renameState) {
              config.renameState(getState(), blockInstanceId, title);
            }
          },
        })(set, get, store),

        ...(runtimeConfig.syncEnabled
          ? createCrdtSlice<RoomState>({
              storage: createIndexedDbDocStorage({key: CRDT_STORAGE_KEY}),
              sync: createCliCrdtSyncConnector(),
              mirrors: {
                documentState: createDocumentsCrdtMirror<RoomState>({
                  blockDocumentArtifactTypes: ['worksheet'],
                }),
              },
            })(set, get, store)
          : createDisabledCrdtState()),

        ...createWebContainerSlice({
          autoInitialize: false,
          config: {
            filesTree: getDefaultScaffoldTree(),
            activeFilePath: '/src/App.jsx',
          },
        })(set, get, store),

        ...createAiSettingsSlice({
          config: {
            providers: runtimeAiProviders,
            ...(runtimeAiSettings.customModels
              ? {customModels: runtimeAiSettings.customModels}
              : {}),
            ...(runtimeAiSettings.modelParameters
              ? {
                  modelParameters: {
                    maxSteps: runtimeAiSettings.modelParameters.maxSteps ?? 50,
                    additionalInstruction:
                      runtimeAiSettings.modelParameters.additionalInstruction ??
                      '',
                  },
                }
              : {}),
          },
        })(set, get, store),

        ...(() => {
          const webContainerToolkit = createWebContainerToolkit(store);
          return createAiSlice({
            config: AiSliceConfig.parse({sessions: []}),
            defaultProvider: defaultProviderFromConfig as any,
            defaultModel: defaultModelFromConfig,
            getAvailableModels: () =>
              getAvailableAiModels(get().aiSettings.config),
            getApiKey: (provider) =>
              get().aiSettings.config.providers[provider]?.apiKey ||
              runtimeConfig.apiKey ||
              '',
            getBaseUrl: () => runtimeConfig.apiBaseUrl || '',
            getInstructions: () =>
              `${createDefaultAiInstructions(store)}\n\n${getDashboardAiInstructions(store)}\n\n${DOCUMENT_AI_INSTRUCTIONS}\n\n${createBlockDocumentAiInstructions(WORKSHEET_BLOCK_DOCUMENT_OPTIONS)}\n\n${createBlockDocumentAuthoringInstructions(WORKSHEET_BLOCK_DOCUMENT_OPTIONS)}`,
            getRunContext: () => getRunContext(store),
            formatRunContextInstructions: ({runContext}) =>
              formatRunContextInstructions(runContext, store),
            tools: {
              ...createDefaultAiTools(store, {query: {}}),
              ...createArtifactContextAiTools(store),
              ...createDashboardAiTools(store),
              dashboard_agent: dashboardAgentTool(store),
              ...webContainerToolkit.tools,
              chart: createVegaChartTool(),
              chart_image_for_markdown: createChartImageForMarkdownTool(store),
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

function getAiSettingsTomlPayload(state: RoomState) {
  const currentSession = state.ai.getCurrentSession();
  return {
    settings: state.aiSettings.config,
    defaultProvider: currentSession?.modelProvider || defaultProviderFromConfig,
    defaultModel: currentSession?.model || defaultModelFromConfig,
  };
}

function startAiSettingsTomlAutosave() {
  if (!runtimeConfig.configWritable) return;

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let latestSaveRequestId = 0;
  let lastSnapshot = JSON.stringify(
    getAiSettingsTomlPayload(roomStore.getState()),
  );

  roomStore.subscribe((state) => {
    const snapshot = JSON.stringify(getAiSettingsTomlPayload(state));
    if (snapshot === lastSnapshot) return;

    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const saveRequestId = ++latestSaveRequestId;
      void saveAiSettingsToServer(
        runtimeConfig,
        JSON.parse(snapshot) as ReturnType<typeof getAiSettingsTomlPayload>,
      )
        .then(() => {
          if (saveRequestId !== latestSaveRequestId) return;
          lastSnapshot = snapshot;
        })
        .catch((error) => {
          if (saveRequestId !== latestSaveRequestId) return;
          console.warn('Failed to save AI settings to SQLRooms config', error);
          toast.error('Failed to save AI settings', {
            id: AI_SETTINGS_SAVE_FAILED_TOAST_ID,
            description:
              'Your changes are still in this session, but could not be written to the SQLRooms config file.',
          });
        });
    }, AI_SETTINGS_TOML_SAVE_DEBOUNCE_MS);
  });
}

startAiSettingsTomlAutosave();
