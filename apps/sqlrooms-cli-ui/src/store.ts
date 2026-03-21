import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  AiSliceConfig,
  AiSliceState,
  createAiSettingsSlice,
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiTools,
  createDefaultAiToolRenderers,
} from '@sqlrooms/ai';
import {VegaChartToolResult} from '@sqlrooms/vega';
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
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {createVegaChartTool} from '@sqlrooms/vega';
import {
  createWebContainerSlice,
  WebContainerSliceConfig,
  WebContainerSliceState,
} from '@sqlrooms/webcontainer';
import {produce} from 'immer';
import {z} from 'zod';

import {createHttpDbBridge, DbConnection} from '@sqlrooms/db';
import type {RuntimeConfig} from './runtimeConfig';
import {getDefaultScaffoldTree} from './helpers';
import {LAYOUT} from './layout';
import {fetchRuntimeConfig} from './runtimeConfig';
import {createDuckDbPersistStorage, uploadFileToServer} from './serverApi';

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
type RuntimeDbBridgeConfig = NonNullable<RuntimeConfig['dbBridge']>;
type ConnectorDriverDiagnostic = NonNullable<
  RuntimeDbBridgeConfig['diagnostics']
>[number];

export type RoomState = RoomShellSliceState &
  AiSliceState &
  SqlEditorSliceState &
  AiSettingsSliceState &
  CellsSliceState &
  NotebookSliceState &
  CanvasSliceState &
  WebContainerSliceState & {
    connectorDriverDiagnostics: ConnectorDriverDiagnostic[];
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

function getRuntimeBridgeConfig(): RuntimeDbBridgeConfig | undefined {
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
      },
      storage: createDuckDbPersistStorage(connector, {
        namespace: runtimeConfig.metaNamespace || '__sqlrooms',
      }),
    },
    (set, get, store) => ({
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
      connectorDriverDiagnostics: runtimeConfig.dbBridge?.diagnostics || [],
      isAssistantOpen: false,
      setAssistantOpen: (isAssistantOpen: boolean) => {
        set({isAssistantOpen});
      },

      ...createRoomShellSlice({
        connector,
        config: {dataSources: []},
        layout: LAYOUT,
      })(set, get, store),

      ...createSqlEditorSlice()(set, get, store),

      ...createCellsSlice({
        cellRegistry: createDefaultCellRegistry(),
        supportedSheetTypes: ['notebook', 'canvas', 'app'],
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
        getInstructions: () => createDefaultAiInstructions(store),
        tools: {
          ...createDefaultAiTools(store, {query: {}}),
          chart: createVegaChartTool(),
        },
        toolRenderers: {
          ...createDefaultAiToolRenderers(),
          chart: VegaChartToolResult,
        },
      })(set, get, store),
    }),
  ),
);

const bridgeConfig = getRuntimeBridgeConfig();
if (bridgeConfig?.connections.length) {
  const diagnosticsKey = (id: string, engineId: string) => `${id}:${engineId}`;
  const diagnosticsById = new Map(
    (bridgeConfig.diagnostics || []).map((item) => [
      diagnosticsKey(item.id, item.engineId),
      item,
    ]),
  );
  const bridge = createHttpDbBridge({
    id: bridgeConfig.id,
    baseUrl: runtimeConfig.apiBaseUrl || '',
  });
  const state = roomStore.getState();
  state.db.connectors.registerBridge(bridge);
  for (const connection of bridgeConfig.connections) {
    const diagnostics = diagnosticsById.get(
      diagnosticsKey(connection.id, connection.engineId),
    );
    if (diagnostics && diagnostics.available === false) {
      continue;
    }
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
