import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  AiSliceConfig,
  AiSliceState,
  createAiSettingsSlice,
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiToolRenderers,
  createDefaultAiTools,
} from '@sqlrooms/ai';
import {
  CanvasSliceConfig,
  CanvasSliceState,
  createCanvasSlice,
} from '@sqlrooms/canvas';
import {
  CellsSliceConfig,
  CellsSliceState,
  createCellsSlice,
  createDefaultCellRegistry,
} from '@sqlrooms/cells';
import {createWebSocketDuckDbConnector} from '@sqlrooms/duckdb';
import type {MosaicSliceState} from '@sqlrooms/mosaic';
import {createMosaicSlice} from '@sqlrooms/mosaic';
import {
  createNotebookSlice,
  NotebookSliceConfig,
  NotebookSliceState,
} from '@sqlrooms/notebook';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  persistSliceConfigs,
  registerCommandsForOwner,
  RoomShellSliceState,
  unregisterCommandsForOwner,
} from '@sqlrooms/room-shell';
import {
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {createVegaChartTool, VegaChartToolResult} from '@sqlrooms/vega';
import {
  createWebContainerSlice,
  WebContainerSliceConfig,
  WebContainerSliceState,
} from '@sqlrooms/webcontainer';
import {produce} from 'immer';
import {z} from 'zod';

import {createHttpDbBridge, DbConnection} from '@sqlrooms/db';
import {
  createDashboardAiTools,
  DASHBOARD_AI_INSTRUCTIONS,
} from './createDashboardAiTools';
import {
  createDashboardCommands,
  DASHBOARD_COMMAND_OWNER,
} from './createDashboardCommands';
import {getDefaultScaffoldTree} from './helpers';
import {LAYOUT} from './layout';
import {fetchRuntimeConfig} from './runtimeConfig';
import {createDuckDbPersistStorage, uploadFileToServer} from './serverApi';
import {DEFAULT_DASHBOARD_VGPLOT_SPEC, parseVgPlotSpecString} from './vgplot';

export const AppBuilderProjectConfig = z.object({
  appsBySheetId: z
    .record(
      z.string(),
      z.object({
        name: z.string().default('Untitled App'),
        prompt: z.string().default(''),
        template: z.string().default('mosaic-dashboard'),
        files: z.record(z.string(), z.string()).default({}),
        updatedAt: z.number().default(0),
      }),
    )
    .default({}),
});
export type AppBuilderProjectConfig = z.infer<typeof AppBuilderProjectConfig>;

export const DashboardProjectConfig = z.object({
  dashboardsBySheetId: z
    .record(
      z.string(),
      z.object({
        vgplot: z.string().default(DEFAULT_DASHBOARD_VGPLOT_SPEC),
        updatedAt: z.number().default(0),
      }),
    )
    .default({}),
});
export type DashboardProjectConfig = z.infer<typeof DashboardProjectConfig>;

export type RoomState = RoomShellSliceState &
  MosaicSliceState &
  AiSliceState &
  SqlEditorSliceState &
  AiSettingsSliceState &
  CellsSliceState &
  NotebookSliceState &
  CanvasSliceState &
  WebContainerSliceState & {
    appProject: {
      config: AppBuilderProjectConfig;
      upsertSheetApp: (
        sheetId: string,
        app: Partial<AppBuilderProjectConfig['appsBySheetId'][string]> & {
          name: string;
        },
      ) => void;
      updateSheetAppFiles: (
        sheetId: string,
        files: Record<string, string>,
      ) => void;
      getSheetApp: (
        sheetId: string,
      ) => AppBuilderProjectConfig['appsBySheetId'][string] | undefined;
    };
    dashboard: {
      initialize?: () => Promise<void>;
      destroy?: () => Promise<void>;
      config: DashboardProjectConfig;
      ensureSheetDashboard: (sheetId: string) => void;
      setSheetVgPlot: (sheetId: string, vgplot: string) => void;
      getSheetVgPlot: (sheetId: string) => string | undefined;
      getCurrentDashboardSheetId: () => string | undefined;
      createDashboardSheet: (title?: string) => string;
      setCurrentSheetVgPlot: (vgplot: string) => string;
    };
    isAssistantOpen: boolean;
    setAssistantOpen: (isAssistantOpen: boolean) => void;
  };

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

function getRuntimeBridgeConfig():
  | {
      id: string;
      connections: Array<{
        id: string;
        engineId: string;
        title: string;
        runtimeSupport?: 'browser' | 'server' | 'both';
        requiresBridge?: boolean;
        bridgeId?: string;
        isCore?: boolean;
      }>;
    }
  | undefined {
  if (runtimeConfig.dbBridge?.connections?.length) {
    return runtimeConfig.dbBridge;
  }
  return undefined;
}

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs<RoomState>(
    {
      name: 'sqlrooms-cli-app-state',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        ai: AiSliceConfig,
        // aiSettings: AiSettingsSliceConfig,
        sqlEditor: SqlEditorSliceConfig,
        cells: CellsSliceConfig,
        notebook: NotebookSliceConfig,
        canvas: CanvasSliceConfig,
        webContainer: WebContainerSliceConfig,
        appProject: AppBuilderProjectConfig,
        dashboard: DashboardProjectConfig,
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
        config: DashboardProjectConfig.parse({}),
        ensureSheetDashboard: (sheetId) => {
          const sheet = get().cells.config.sheets[sheetId];
          if (!sheet || sheet.type !== 'dashboard') {
            return;
          }
          set((state) =>
            produce(state, (draft) => {
              if (draft.dashboard.config.dashboardsBySheetId[sheetId]) {
                return;
              }
              draft.dashboard.config.dashboardsBySheetId[sheetId] = {
                vgplot: DEFAULT_DASHBOARD_VGPLOT_SPEC,
                updatedAt: Date.now(),
              };
            }),
          );
        },
        setSheetVgPlot: (sheetId, vgplot) => {
          const sheet = get().cells.config.sheets[sheetId];
          if (!sheet) {
            throw new Error(`Unknown sheet "${sheetId}".`);
          }
          if (sheet.type !== 'dashboard') {
            throw new Error(`Sheet "${sheetId}" is not a dashboard sheet.`);
          }
          const {formatted} = parseVgPlotSpecString(vgplot);
          set((state) =>
            produce(state, (draft) => {
              draft.dashboard.config.dashboardsBySheetId[sheetId] = {
                vgplot: formatted,
                updatedAt: Date.now(),
              };
            }),
          );
        },
        getSheetVgPlot: (sheetId) =>
          get().dashboard.config.dashboardsBySheetId[sheetId]?.vgplot,
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
          get().dashboard.ensureSheetDashboard(sheetId);
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
            set(
              produce((draft: RoomState) => {
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
        isAssistantOpen: false,
        setAssistantOpen: (isAssistantOpen: boolean) => {
          set({isAssistantOpen});
        },

        ...createRoomShellSlice({
          connector,
          config: {dataSources: []},
          layout: LAYOUT,
        })(set, get, store),

        ...createMosaicSlice()(set, get, store),

        ...createSqlEditorSlice()(set, get, store),

        ...createCellsSlice({
          cellRegistry: createDefaultCellRegistry(),
          supportedSheetTypes: ['notebook', 'canvas', 'app', 'dashboard'],
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

        ...createAiSlice({
          config: AiSliceConfig.parse({sessions: []}),
          defaultProvider: defaultProviderFromConfig as any,
          defaultModel: defaultModelFromConfig,
          getApiKey: (provider) =>
            runtimeAiProviders[provider]?.apiKey || runtimeConfig.apiKey || '',
          getBaseUrl: () => runtimeConfig.apiBaseUrl || '',
          getInstructions: () =>
            `${createDefaultAiInstructions(store)}\n\n${DASHBOARD_AI_INSTRUCTIONS}`,
          tools: {
            ...createDefaultAiTools(store, {query: {}}),
            ...createDashboardAiTools(store),
            chart: createVegaChartTool(),
          },
          toolRenderers: {
            ...createDefaultAiToolRenderers(),
            chart: VegaChartToolResult,
          },
        })(set, get, store),
      };
    },
  ),
);

const bridgeConfig = getRuntimeBridgeConfig();
if (bridgeConfig?.connections.length) {
  const bridge = createHttpDbBridge({
    id: bridgeConfig.id,
    baseUrl: runtimeConfig.apiBaseUrl || '',
  });
  const state = roomStore.getState();
  state.db.connectors.registerBridge(bridge);
  for (const connection of bridgeConfig.connections) {
    const normalizedConnection: DbConnection = {
      id: connection.id,
      engineId: connection.engineId,
      title: connection.title || connection.id,
      runtimeSupport: connection.runtimeSupport || 'server',
      requiresBridge: connection.requiresBridge ?? true,
      bridgeId: connection.bridgeId || bridgeConfig.id,
      isCore: connection.isCore ?? false,
    };
    state.db.connectors.registerConnection(normalizedConnection);
  }
}
