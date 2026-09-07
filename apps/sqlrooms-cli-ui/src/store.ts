import {ArtifactsSliceConfig, createArtifactsSlice} from '@sqlrooms/artifacts';
import {
  ArtifactAiConfigSchema,
  createArtifactAiSlice,
} from '@sqlrooms/artifacts/ai';
import {
  AiSettingsSliceConfig,
  AiSliceConfig,
  getAiRunContextPrimaryItem,
  createAiSettingsSlice,
  createAiSlice,
  createDefaultAiToolRenderers,
} from '@sqlrooms/ai';
import {
  createHtmlAppRuntimeSlice,
  HtmlAppRuntimeConfig,
} from '@sqlrooms/app-runtime';
import {CanvasSliceConfig, createCanvasSlice} from '@sqlrooms/canvas';
import {
  CellsSliceConfig,
  createCellsSlice,
  createDefaultCellRegistry,
} from '@sqlrooms/cells';
import {createDeckMapsSlice, DeckMapsSliceConfig} from '@sqlrooms/deck';
import {createDeckMapDashboardSliceOptions} from '@sqlrooms/deck/mosaic';
import {
  arrowTableToJson,
  createDefaultLoadTableSchemasFilter,
  defaultLoadSchemaCatalogFilter,
  escapeVal,
  makeQualifiedTableName,
  QualifiedTableName,
  quoteParsedRawSqlTableReference,
  type SchemaCatalogFilterEntry,
} from '@sqlrooms/duckdb';
import {
  CrdtSliceState,
  createCrdtSlice,
  createIndexedDbDocStorage,
  createWebSocketSyncConnector,
} from '@sqlrooms/crdt';
import {
  createDefaultChartTypes,
  createDefaultMosaicDashboardPanelRenderers,
  createDashboardFeatureSlices,
  createMosaicDashboardDataTableExplorerPanelConfig,
  createMosaicSlice,
  defaultAddPanelActions,
  MOSAIC_DASHBOARD_DATA_TABLE_EXPLORER_PANEL_TYPE,
  MosaicDashboardSliceConfig,
} from '@sqlrooms/mosaic';
import {createNotebookSlice, NotebookSliceConfig} from '@sqlrooms/notebook';
import {createPivotSlice, PivotSliceConfig} from '@sqlrooms/pivot';
import {createPythonSlice, PythonSliceConfig} from '@sqlrooms/python/block';
import {
  createPyodidePythonRuntimeAdapter,
  type PythonRuntimeHost,
} from '@sqlrooms/python/runtime';
import {
  BaseRoomConfig,
  createPersistHelpers,
  createRoomShellSlice,
  createRoomStore,
  DEFAULT_ROOM_TITLE,
  LayoutConfig,
  persistSliceConfigs,
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
  BlockDocumentsSliceConfig,
  createBlockDocumentsSlice,
  createDocumentsSlice,
  DocumentsSliceConfig,
} from '@sqlrooms/documents';
import {createDocumentsCrdtMirror} from '@sqlrooms/documents/crdt';
import {toast} from '@sqlrooms/ui';
import {artifactChatAssociationMiddleware} from './artifactChatAssociation';
import {createCliArtifactTypes} from './artifactTypes';
import {formatRunContextInstructions} from './context/formatRunContextInstructions';
import {getRunContext} from './context/getRunContext';
import {createCliAiInstructions} from './createCliAiInstructions';
import {createCliAiTools} from './createCliAiTools';
import {createRenderedSurfaceAiToolkit} from './ai/createRenderedSurfaceAiToolkit';
import {dashboardAgentTool} from './createDashboardAgent';
import {htmlAppAgentTool} from './createHtmlAppAgent';
import {getDefaultScaffoldTree} from './helpers';
import {createLayout, migrateCliLayoutConfig} from './layout';
import {migrateCliPersistedWorkspace} from './migrateCliPersistedWorkspace';
import {
  cliDuckDbConnector as connector,
  MOSAIC_PREAGG_SCHEMA_REF,
} from './duckDbRuntime';
import type {RuntimeConfig} from './runtimeConfig';
import {
  aiDevtoolsEnabled,
  cliCapabilityProfile,
  runtimeConfig,
} from './runtimeEnvironment';
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
  getStatefulBlockArtifactConfig,
  isStatefulBlockArtifactType,
} from './statefulBlockArtifactConfigs';
import {
  registerCliCapabilityProfileCommands,
  unregisterCliCapabilityProfileCommands,
} from './registerCliCapabilityProfileCommands';

export type {RoomState} from './store-types';

const AI_SETTINGS_SAVE_FAILED_TOAST_ID = 'ai-settings-save-failed';

const cliArtifactTypes = createCliArtifactTypes({
  profile: cliCapabilityProfile,
});
const defaultWorkspaceTitle = getDefaultWorkspaceTitle(runtimeConfig);
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
const CLI_PYTHON_EXECUTION_TIMEOUT_MS = 120_000;
const CRDT_STORAGE_KEY = [
  'sqlrooms-cli',
  runtimeConfig.metaNamespace || '__sqlrooms',
  runtimeConfig.dbPath || 'memory',
  'documents',
].join(':');
const AI_SETTINGS_TOML_SAVE_DEBOUNCE_MS = 500;

function getDefaultWorkspaceTitle(config: RuntimeConfig) {
  const dbPath = config.dbPath?.trim();
  if (!dbPath || dbPath === ':memory:' || dbPath === 'memory') {
    return 'Untitled Workspace';
  }

  const normalizedPath = dbPath.replace(/[/\\]+$/, '');
  const fileName =
    normalizedPath.split(/[\\/]/).filter(Boolean).pop() ?? normalizedPath;
  const extensionIndex = fileName.lastIndexOf('.');
  const title =
    extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;

  return title || 'Untitled Workspace';
}

function migrateCliRoomConfig(roomConfig: unknown) {
  if (!roomConfig || typeof roomConfig !== 'object') {
    return roomConfig;
  }

  const title = (roomConfig as {title?: unknown}).title;
  if (
    typeof title !== 'string' ||
    title.trim().length === 0 ||
    title === DEFAULT_ROOM_TITLE
  ) {
    return {
      ...roomConfig,
      title: defaultWorkspaceTitle,
    };
  }

  return roomConfig;
}

function createCliCrdtSyncConnector() {
  if (!runtimeConfig.syncEnabled) return undefined;
  return createWebSocketSyncConnector({
    url:
      runtimeConfig.crdtWsUrl || runtimeConfig.wsUrl || 'ws://localhost:4000',
    roomId:
      runtimeConfig.crdtRoomId ||
      `sqlrooms-cli:${runtimeConfig.metaNamespace || '__sqlrooms'}:${runtimeConfig.dbPath || 'memory'}`,
    token: runtimeConfig.wsAuthToken,
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

const baseLoadFile = connector.loadFile.bind(connector);
connector.loadFile = async (file, desiredTableName, options) => {
  if (file instanceof File) {
    const serverPath = await uploadFileToServer(file, runtimeConfig);
    const renamedFile = new File([file], serverPath, {type: file.type});
    return baseLoadFile(renamedFile, desiredTableName, options);
  }
  return baseLoadFile(file, desiredTableName, options);
};

function createCliPythonRuntimeHost(): PythonRuntimeHost {
  return {
    readTable: ({tableName, maxRows}) =>
      runReadonlyPythonSql(
        `SELECT * FROM ${getCliRawSqlTableReference(tableName)}`,
        maxRows,
      ),
    runReadonlySql: ({query, maxRows}) => runReadonlyPythonSql(query, maxRows),
    readSchema: ({tableName}) => readPythonSchema(tableName),
  };
}

async function runReadonlyPythonSql(query: string, maxRows?: number) {
  await assertSingleReadonlyPythonSql(query);
  const arrowTable = await connector.query(
    wrapPythonReadonlyQuery(query, maxRows),
  );
  const rows = arrowTableToPythonRows(arrowTable);
  return {
    columns: arrowTable.schema.fields.map((field) => field.name),
    columnTypes: getPythonColumnTypes(arrowTable),
    rows,
    rowCount: rows.length,
  };
}

function wrapPythonReadonlyQuery(query: string, maxRows?: number) {
  const trimmedQuery = query.trim().replace(/;+$/, '');
  if (hasStackedSqlStatements(query)) {
    throw new Error('Python SQL bridge only allows a single readonly query.');
  }
  const limit =
    maxRows === undefined ? '' : ` LIMIT ${Math.max(0, Math.floor(maxRows))}`;
  return `SELECT * FROM (\n${trimmedQuery}\n) AS sqlrooms_python_query${limit}`;
}

async function assertSingleReadonlyPythonSql(query: string) {
  if (hasStackedSqlStatements(query)) {
    throw new Error('Python SQL bridge only allows a single readonly query.');
  }

  let parsedQuery: unknown;
  try {
    const result = await connector.query(
      `SELECT json_serialize_sql(${escapeVal(query)})`,
    );
    parsedQuery = JSON.parse(String(result.getChildAt(0)?.get(0)));
  } catch {
    throw new Error(
      'Python SQL bridge only allows a single readonly SELECT query.',
    );
  }

  const statements =
    parsedQuery &&
    typeof parsedQuery === 'object' &&
    'statements' in parsedQuery &&
    Array.isArray(parsedQuery.statements)
      ? parsedQuery.statements
      : [];
  const nodeType = String(
    (statements[0] as {node?: {type?: unknown}} | undefined)?.node?.type ?? '',
  ).toLowerCase();

  if (statements.length !== 1 || !nodeType.includes('select')) {
    throw new Error(
      'Python SQL bridge only allows a single readonly SELECT query.',
    );
  }
}

function arrowTableToPythonRows(table: {
  schema: {
    fields: Array<{
      name: string;
      type?: unknown;
    }>;
  };
  toArray(): Array<Record<string, unknown>>;
}): Record<string, unknown>[] {
  const typeByFieldName = new Map(
    table.schema.fields.map((field) => [field.name, String(field.type ?? '')]),
  );
  return table
    .toArray()
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          convertPythonBridgeValue(value, typeByFieldName.get(key)),
        ]),
      ),
    );
}

function getPythonColumnTypes(table: {
  schema: {
    fields: Array<{
      name: string;
      type?: unknown;
    }>;
  };
}) {
  return Object.fromEntries(
    table.schema.fields
      .map((field) => [field.name, getPythonColumnType(field.type)] as const)
      .filter((entry): entry is readonly [string, 'date' | 'timestamp'] =>
        Boolean(entry[1]),
      ),
  );
}

function getPythonColumnType(type: unknown): 'date' | 'timestamp' | undefined {
  const normalizedType = String(type ?? '').toLowerCase();
  if (normalizedType.startsWith('date')) return 'date';
  if (normalizedType.startsWith('timestamp')) return 'timestamp';
  return undefined;
}

function convertPythonBridgeValue(value: unknown, arrowType?: string): unknown {
  if (value == null) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'bigint') {
    if (value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER) {
      return Number(value);
    }
    return String(value);
  }
  if (value instanceof Date) {
    return arrowType?.toLowerCase().startsWith('date')
      ? value.toISOString().slice(0, 10)
      : value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => convertPythonBridgeValue(item));
  }
  if (typeof value === 'object') {
    const jsonValue =
      'toJSON' in value && typeof value.toJSON === 'function'
        ? value.toJSON()
        : undefined;
    if (jsonValue !== undefined && jsonValue !== value) {
      return convertPythonBridgeValue(jsonValue, arrowType);
    }
  }
  return String(value);
}

function hasStackedSqlStatements(query: string) {
  const trailingSemicolonStart = findTrailingSemicolonStart(query);
  let quote: "'" | '"' | undefined;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < query.length; index += 1) {
    const char = query[index];
    const next = query[index + 1];

    if (lineComment) {
      if (char === '\n' || char === '\r') {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (char === quote) {
        if (next === quote) {
          index += 1;
          continue;
        }
        quote = undefined;
      }
      continue;
    }

    if (char === '-' && next === '-') {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (char === ';' && index < trailingSemicolonStart) {
      return true;
    }
  }

  return false;
}

function findTrailingSemicolonStart(query: string) {
  let index = query.length - 1;
  while (index >= 0 && /\s/.test(query[index]!)) {
    index -= 1;
  }
  while (index >= 0 && query[index] === ';') {
    index -= 1;
    while (index >= 0 && /\s/.test(query[index]!)) {
      index -= 1;
    }
  }
  return index + 1;
}

async function readPythonSchema(tableName?: string) {
  if (tableName) {
    const arrowTable = await connector.query(
      `SELECT * FROM ${getCliRawSqlTableReference(tableName)} LIMIT 0`,
    );
    return {
      tables: [
        {
          tableName,
          columns: arrowTable.schema.fields.map((field) => ({
            name: field.name,
            type: String(field.type),
          })),
        },
      ],
    };
  }

  const arrowTable = await connector.query(`
    SELECT table_catalog, table_schema, table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_catalog, table_schema, table_name, ordinal_position
  `);
  const rows = arrowTableToJson(arrowTable);
  const currentDatabase = await readCurrentDatabaseName();
  const tables = new Map<string, Array<{name: string; type?: string}>>();
  for (const row of rows) {
    const catalogName = String(row.table_catalog ?? '');
    const schemaName = String(row.table_schema ?? 'main');
    const currentTableName = String(row.table_name ?? '');
    const columnName = String(row.column_name ?? '');
    if (!currentTableName || !columnName) continue;
    const table = makeQualifiedTableName({
      database: catalogName || undefined,
      schema: schemaName || undefined,
      table: currentTableName,
      defaultDatabase: currentDatabase,
    });
    if (!isPythonSchemaTableVisible(table, currentDatabase)) {
      continue;
    }
    const qualifiedTableName = table.toFullString();
    const columns = tables.get(qualifiedTableName) ?? [];
    columns.push({
      name: columnName,
      type: row.data_type === undefined ? undefined : String(row.data_type),
    });
    tables.set(qualifiedTableName, columns);
  }

  return {
    tables: [...tables.entries()].map(([qualifiedTableName, columns]) => ({
      tableName: qualifiedTableName,
      columns,
    })),
  };
}

function getCliRawSqlTableReference(tableName: string) {
  const tableReference = quoteParsedRawSqlTableReference(tableName);
  if (!tableReference) {
    throw new Error(`Invalid table reference "${tableName}".`);
  }
  return tableReference;
}

async function readCurrentDatabaseName() {
  const result = await connector.query('SELECT current_database()');
  const value = result.getChildAt(0)?.get(0);
  return value == null ? undefined : String(value);
}

function isPythonSchemaTableVisible(
  table: QualifiedTableName,
  currentDatabase: string | undefined,
) {
  const database = table.database;
  const schema = table.schema;

  if (
    database &&
    !defaultLoadSchemaCatalogFilter({type: 'database', database})
  ) {
    return false;
  }

  if (
    database &&
    schema &&
    !defaultLoadSchemaCatalogFilter({type: 'schema', database, schema})
  ) {
    return false;
  }

  if (!defaultLoadSchemaCatalogFilter({type: 'table', table})) {
    return false;
  }

  return !(table.database === currentDatabase && table.schema === 'mosaic');
}

function getRuntimeBridgeConfig() {
  if (runtimeConfig.dbBridge?.connections?.length) {
    return runtimeConfig.dbBridge;
  }
  return undefined;
}

// Capability profiles gate exposed behavior, not lifecycle state. Keep every
// persisted slice registered so disabled content round-trips through narrower
// profiles and can be restored when its capability is enabled again.
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
  htmlApps: HtmlAppRuntimeConfig,
  appProject: AppBuilderProjectConfigSchema,
  artifactAi: ArtifactAiConfigSchema,
  mosaicDashboard: MosaicDashboardSliceConfig,
  deckMaps: DeckMapsSliceConfig,
  pivot: PivotSliceConfig,
  python: PythonSliceConfig,
} as const;

const persistHelpers = createPersistHelpers(sliceConfigSchemas);
type PersistedRoomState = ReturnType<typeof persistHelpers.partialize>;
const cliUiPersistStorage = createDuckDbPersistStorage<PersistedRoomState>(
  connector,
  {
    namespace: runtimeConfig.metaNamespace || '__sqlrooms',
  },
);
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
  persistSliceConfigs<RoomState, typeof sliceConfigSchemas>(
    {
      name: 'sqlrooms-cli-app-state',
      sliceConfigSchemas,
      storage: cliUiPersistStorage,
      partialize: persistHelpers.partialize,
      merge: (persistedState, currentState) => {
        const persistedRecord = migrateCliPersistedWorkspace(
          persistedState ?? {},
        );
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
            room: migrateCliRoomConfig(persistedRecord.room),
            layout: persistedRecord.layout
              ? migrateCliLayoutConfig(persistedRecord.layout as LayoutConfig)
              : persistedRecord.layout,
          },
          currentState,
        );
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.artifactAi.syncCurrentArtifactAiSession();
        cliUiPersistStorage.markStateSnapshotSaved(
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
          registerCliCapabilityProfileCommands(
            store,
            cliCapabilityProfile,
            cliArtifactTypes,
          );
        },
        destroy: async () => {
          unregisterCliCapabilityProfileCommands(store);
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
        workspaceUi: {
          showArtifactChooser: false,
          setShowArtifactChooser: (show) => {
            set((state) =>
              produce(state, (draft: RoomState) => {
                draft.workspaceUi.showArtifactChooser = show;
              }),
            );
          },
        },

        appProject: {
          config: AppBuilderProjectConfig.parse({}),
          upsertArtifactApp: (artifactId, app) => {
            set((state) =>
              produce(state, (draft: RoomState) => {
                const current = draft.appProject.config.appsByArtifactId[
                  artifactId
                ] ?? {
                  name: app.name,
                  intent: '',
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
          config: {title: defaultWorkspaceTitle, dataSources: []},
          layout: createLayout({artifactTypes: cliArtifactTypes, store}),
          createCommandProps: {
            // createRoomShellSlice is typed to the base room state, but this
            // app middleware needs the composed CLI RoomState at runtime.
            middleware: [artifactChatAssociationMiddleware as any],
          },
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

        ...createArtifactsSlice({
          artifactTypes: cliArtifactTypes,
        })(set, get, store),

        ...createArtifactAiSlice()(set, get, store),

        ...createHtmlAppRuntimeSlice()(set, get, store),

        ...createMosaicSlice({
          preagg: {
            schema: MOSAIC_PREAGG_SCHEMA_REF,
          },
        })(set, get, store),

        ...createDeckMapsSlice()(set, get, store),

        ...createDashboardFeatureSlices(
          cliCapabilityProfile.dashboard.deckMaps
            ? createDeckMapDashboardSliceOptions()
            : {
                addPanelActions: defaultAddPanelActions,
                chartTypes: createDefaultChartTypes(),
                panelRenderers: createDefaultMosaicDashboardPanelRenderers(),
              },
        )(set, get, store),

        ...createSqlEditorSlice()(set, get, store),

        ...createCellsSlice({
          cellRegistry: createDefaultCellRegistry(),
        })(set, get, store),

        ...createNotebookSlice()(set, get, store),

        ...createPivotSlice()(set, get, store),

        ...createPythonSlice({
          runtimeAdapter: createPyodidePythonRuntimeAdapter(),
          host: createCliPythonRuntimeHost(),
          limits: {
            timeoutMs: CLI_PYTHON_EXECUTION_TIMEOUT_MS,
          },
        })(set, get, store),

        ...createCanvasSlice()(set, get, store),

        ...createDocumentsSlice()(set, get, store),

        ...createBlockDocumentsSlice<RoomState>({
          onCreateOwnedStatefulBlock: ({
            blockInstanceId,
            blockType,
            getState,
          }) => {
            if (!isStatefulBlockArtifactType(blockType)) {
              console.warn('Unknown stateful block type on create', {
                blockType,
                blockInstanceId,
              });
              return;
            }
            const config = getStatefulBlockArtifactConfig(blockType);
            // Do not pass embeddedTitle here: create-stateful-block already
            // called ensureState with the command-provided title. Re-running
            // with the generic embedded title would overwrite it.
            config.ensureState(getState(), blockInstanceId);
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
        })(set, get, store),

        ...(runtimeConfig.syncEnabled
          ? createCrdtSlice<RoomState>({
              storage: createIndexedDbDocStorage({key: CRDT_STORAGE_KEY}),
              sync: createCliCrdtSyncConnector(),
              mirrors: {
                documentState: createDocumentsCrdtMirror<RoomState>(),
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
          const renderedSurfaceToolkit = createRenderedSurfaceAiToolkit();
          const tools = createCliAiTools({
            store,
            profile: cliCapabilityProfile,
            webContainerTools: webContainerToolkit.tools,
            createDashboardAgentTool: dashboardAgentTool,
            createHtmlAppAgentTool: htmlAppAgentTool,
            createStandaloneChartTool: createVegaChartTool,
            createChartImageTool: createChartImageForMarkdownTool,
            createRenderedSurfaceImageTools: () => renderedSurfaceToolkit.tools,
          });
          return createAiSlice({
            config: AiSliceConfig.parse({sessions: []}),
            defaultProvider: defaultProviderFromConfig as any,
            defaultModel: defaultModelFromConfig,
            getAvailableModels: () =>
              getAvailableAiModels(get().aiSettings.config),
            getApiKey: (provider) =>
              get().aiSettings.config.providers[provider]?.apiKey || '',
            getBaseUrl: () => runtimeConfig.apiBaseUrl || '',
            getInstructions: () =>
              createCliAiInstructions(store, cliCapabilityProfile),
            getRunContext: (sessionId) =>
              getRunContext(store, sessionId, {
                profile: cliCapabilityProfile,
              }),
            formatRunContextInstructions: ({runContext}) =>
              formatRunContextInstructions(runContext, store),
            tools,
            toolRenderers: {
              ...createDefaultAiToolRenderers(),
              ...webContainerToolkit.toolRenderers,
              ...renderedSurfaceToolkit.toolRenderers,
              chart: VegaChartToolResult,
            },
            devtools: {
              captureAgentSnapshots: aiDevtoolsEnabled,
              persistAgentSnapshots: aiDevtoolsEnabled,
            },
          })(set, get, store);
        })(),
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
