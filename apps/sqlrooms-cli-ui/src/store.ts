import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  AiSliceConfig,
  AiSliceState,
  createAiSettingsSlice,
  createAiSlice,
  createDefaultAiInstructions,
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
import {createHttpDbBridge} from '@sqlrooms/db';
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

export type RoomState = RoomShellSliceState &
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
    isAssistantOpen: boolean;
    setAssistantOpen: (isAssistantOpen: boolean) => void;
  };

export const runtimeConfig = await fetchRuntimeConfig();

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
        config: {providers: {} as AiSettingsSliceConfig['providers']},
      })(set, get, store),

      ...createAiSlice({
        config: AiSliceConfig.parse({sessions: []}),
        defaultProvider: (runtimeConfig.llmProvider as any) || 'openai',
        defaultModel: runtimeConfig.llmModel || 'gpt-4o-mini',
        getApiKey: () => runtimeConfig.apiKey || '',
        getBaseUrl: () => runtimeConfig.apiBaseUrl || '',
        getInstructions: () => createDefaultAiInstructions(store),
        tools: {
          ...createDefaultAiTools(store, {query: {}}),
          chart: createVegaChartTool(),
        },
      })(set, get, store),
    }),
  ),
);

if (runtimeConfig.postgresBridgeEnabled) {
  const postgresBridgeId = 'postgres-http-bridge';
  roomStore.getState().db.connectors.registerBridge(
    createHttpDbBridge({
      id: postgresBridgeId,
      baseUrl: runtimeConfig.apiBaseUrl || '',
      runtimeSupport: 'server',
    }),
  );
  roomStore.getState().db.connectors.registerConnection({
    id: 'postgres',
    engineId: 'postgres',
    title: 'Postgres',
    runtimeSupport: 'server',
    requiresBridge: true,
    bridgeId: postgresBridgeId,
    isCore: false,
  });
}
