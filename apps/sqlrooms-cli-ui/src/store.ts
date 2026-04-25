import {
  AiSettingsSliceConfig,
  AiSliceConfig,
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
  SheetType,
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
  createDefaultMosaicDashboardPanelRenderers,
  createMosaicDashboardProfilerPanelConfig,
  createMosaicDashboardSlice,
  createMosaicDashboardVgPlotPanelConfig,
  createMosaicSlice,
  MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE,
  type MosaicDashboardAddPanelAction,
  MosaicDashboardSliceConfig,
} from '@sqlrooms/mosaic';
import {createNotebookSlice, NotebookSliceConfig} from '@sqlrooms/notebook';
import {
  BaseRoomConfig,
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
import {AppBuilderProjectConfig, RoomState} from './store-types';
import {parseVgPlotSpecString} from './vgplot';

export type {RoomState} from './store-types';

export const runtimeConfig = await fetchRuntimeConfig();
const runtimeAiProviders =
  (runtimeConfig.aiProviders as AiSettingsSliceConfig['providers']) || {};
const defaultProviderFromConfig =
  runtimeConfig.llmProvider || Object.keys(runtimeAiProviders)[0] || 'openai';
const defaultModelFromProvider =
  runtimeAiProviders[defaultProviderFromConfig]?.models?.[0]?.modelName;
const defaultModelFromConfig =
  runtimeConfig.llmModel || defaultModelFromProvider || 'gpt-4o-mini';

const connector = createWebSocketDuckDbConnector({
  wsUrl: runtimeConfig.wsUrl || 'ws://localhost:4000',
  initializationQuery: 'INSTALL spatial; LOAD spatial;',
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

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs<RoomState>(
    {
      name: 'sqlrooms-cli-app-state',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        ai: AiSliceConfig,
        aiSettings: AiSettingsSliceConfig,
        sqlEditor: SqlEditorSliceConfig,
        cells: CellsSliceConfig,
        notebook: NotebookSliceConfig,
        canvas: CanvasSliceConfig,
        webContainer: WebContainerPersistConfig,
        appProject: AppBuilderProjectConfig,
        mosaicDashboard: MosaicDashboardSliceConfig,
      },
      storage: createDuckDbPersistStorage(connector, {
        namespace: runtimeConfig.metaNamespace || '__sqlrooms',
      }),
    },
    (set, get, store) => {
      const getFirstDashboardSheetId = () =>
        Object.values(get().cells.config.sheets).find(
          (sheet) => sheet.type === 'dashboard',
        )?.id;

      const dashboardSlice: RoomState['dashboard'] = {
        initialize: async () => {
          registerCommandsForOwner(
            store,
            DASHBOARD_COMMAND_OWNER,
            createDashboardCommands(),
          );
        },
        destroy: async () => {
          unregisterCommandsForOwner(store, DASHBOARD_COMMAND_OWNER);
        },
        ensureSheetDashboard: (sheetId) => {
          const sheet = get().cells.config.sheets[sheetId];
          if (!sheet || sheet.type !== 'dashboard') {
            return;
          }
          get().mosaicDashboard.ensureDashboard(sheetId, sheet.title);
        },
        addProfilerForTable: (tableName) => {
          const existingDashboardSheetId =
            get().dashboard.getCurrentDashboardSheetId();
          const sheetId =
            existingDashboardSheetId ??
            get().dashboard.createDashboardSheet('Dashboard');
          if (!existingDashboardSheetId) {
            get().cells.setCurrentSheet(sheetId);
          }
          get().dashboard.ensureSheetDashboard(sheetId);
          const dashboard = get().mosaicDashboard.getDashboard(sheetId);
          if (!dashboard) return sheetId;

          if (!dashboard.selectedTable) {
            get().mosaicDashboard.setSelectedTable(sheetId, tableName);
          }

          const hasProfilerForTable = dashboard.panels.some(
            (panel) =>
              panel.type === MOSAIC_DASHBOARD_PROFILER_PANEL_TYPE &&
              panel.source?.tableName === tableName,
          );
          if (!hasProfilerForTable) {
            get().mosaicDashboard.addPanel(
              sheetId,
              createMosaicDashboardProfilerPanelConfig({
                title: `${tableName} profiler`,
                source: {tableName},
              }),
            );
          }

          return sheetId;
        },
        setSheetVgPlot: (sheetId, vgplot) => {
          const sheet = get().cells.config.sheets[sheetId];
          if (!sheet) {
            throw new Error(`Unknown sheet "${sheetId}".`);
          }
          if (sheet.type !== 'dashboard') {
            throw new Error(`Sheet "${sheetId}" is not a dashboard sheet.`);
          }
          const {parsed} = parseVgPlotSpecString(vgplot);
          get().dashboard.ensureSheetDashboard(sheetId);
          const dashboard = get().mosaicDashboard.getDashboard(sheetId);
          const primaryPanel = dashboard?.panels.find(
            (panel) => panel.type === 'vgplot',
          );
          if (primaryPanel) {
            get().mosaicDashboard.updatePanel(sheetId, primaryPanel.id, {
              config: {
                ...primaryPanel.config,
                vgplot: parsed,
              },
            });
            return;
          }
          get().mosaicDashboard.addPanel(
            sheetId,
            createMosaicDashboardVgPlotPanelConfig(parsed, 'Chart 1'),
          );
        },
        getSheetVgPlot: (sheetId) =>
          (() => {
            const spec = get()
              .mosaicDashboard.getDashboard(sheetId)
              ?.panels.find((panel) => panel.type === 'vgplot')?.config.vgplot;
            return spec && typeof spec === 'object'
              ? JSON.stringify(spec, null, 2)
              : undefined;
          })(),
        getCurrentDashboardSheetId: () => {
          const currentSheetId = get().cells.config.currentSheetId;
          const currentSheet = currentSheetId
            ? get().cells.config.sheets[currentSheetId]
            : undefined;
          if (currentSheet?.type === 'dashboard') {
            return currentSheetId;
          }
          return getFirstDashboardSheetId();
        },
        createDashboardSheet: (title) => {
          const sheetId = get().cells.addSheet(title, 'dashboard');
          const sheet = get().cells.config.sheets[sheetId];
          get().mosaicDashboard.ensureDashboard(sheetId, sheet?.title);
          return sheetId;
        },
        setCurrentSheetVgPlot: (vgplot) => {
          const state = get();
          const targetSheetId =
            state.dashboard.getCurrentDashboardSheetId() ??
            state.dashboard.createDashboardSheet();
          state.dashboard.setSheetVgPlot(targetSheetId, vgplot);
          state.cells.setCurrentSheet(targetSheetId);
          return targetSheetId;
        },
      };

      return {
        appProject: {
          config: AppBuilderProjectConfig.parse({}),
          upsertSheetApp: (sheetId, app) => {
            set((state) =>
              produce(state, (draft: RoomState) => {
                const current = draft.appProject.config.appsBySheetId[
                  sheetId
                ] ?? {
                  name: app.name,
                  prompt: '',
                  template: 'mosaic-dashboard',
                  files: {},
                  updatedAt: 0,
                };
                draft.appProject.config.appsBySheetId[sheetId] = {
                  ...current,
                  ...app,
                  updatedAt: Date.now(),
                };
              }),
            );
          },
          updateSheetAppFiles: (sheetId, files) => {
            set((state) =>
              produce(state, (draft) => {
                const current = draft.appProject.config.appsBySheetId[sheetId];
                if (!current) return;
                draft.appProject.config.appsBySheetId[sheetId] = {
                  ...current,
                  files,
                  updatedAt: Date.now(),
                };
              }),
            );
          },
          getSheetApp: (sheetId) =>
            get().appProject.config.appsBySheetId[sheetId],
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

        ...createMosaicSlice()(set, get, store),

        ...createMosaicDashboardSlice({
          addPanelActions: [deckMapDashboardAddPanelAction],
          panelRenderers: createDefaultMosaicDashboardPanelRenderers({
            [DECK_MAP_DASHBOARD_PANEL_TYPE]: deckMapDashboardPanelRenderer,
          }),
        })(set, get, store),

        ...createSqlEditorSlice()(set, get, store),

        ...createCellsSlice({
          cellRegistry: createDefaultCellRegistry(),
          supportedSheetTypes: Object.keys(ARTIFACT_TYPES) as SheetType[],
        })(set, get, store),

        ...createNotebookSlice()(set, get, store),

        ...createCanvasSlice()(set, get, store),

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
              `${createDefaultAiInstructions(store)}\n\n${getDashboardAiInstructions(store)}`,
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
