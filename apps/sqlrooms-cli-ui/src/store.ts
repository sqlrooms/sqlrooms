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
  LayoutTypes,
  MAIN_VIEW,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {SpinnerPane} from '@sqlrooms/ui';
import {createVegaChartTool} from '@sqlrooms/vega';
import {
  createWebContainerSlice,
  WebContainerSliceConfig,
  WebContainerSliceState,
} from '@sqlrooms/webcontainer';
import {DatabaseIcon} from 'lucide-react';
import {createElement, Suspense} from 'react';
import {z} from 'zod';

import {DataSourcesPanel} from './components/DataSourcesPanel';
import {MainView} from './components/MainView';
import {fetchRuntimeConfig} from './runtimeConfig';
import {createDuckDbPersistStorage, uploadFileToServer} from './serverApi';

export const RoomPanelTypes = z.enum(['data-sources', MAIN_VIEW] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

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
        webcontainer: WebContainerSliceConfig,
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
          set((state) => ({
            appProject: {
              ...state.appProject,
              config: {
                ...state.appProject.config,
                appsBySheetId: {
                  ...state.appProject.config.appsBySheetId,
                  [sheetId]: {
                    ...state.appProject.config.appsBySheetId[sheetId],
                    ...app,
                    updatedAt: Date.now(),
                  },
                },
              },
            },
          }));
        },
        updateSheetAppFiles: (sheetId, files) => {
          const current = get().appProject.config.appsBySheetId[sheetId];
          if (!current) return;
          set((state) => ({
            appProject: {
              ...state.appProject,
              config: {
                ...state.appProject.config,
                appsBySheetId: {
                  ...state.appProject.config.appsBySheetId,
                  [sheetId]: {
                    ...current,
                    files,
                    updatedAt: Date.now(),
                  },
                },
              },
            },
          }));
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
        layout: {
          config: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              first: RoomPanelTypes.enum['data-sources'],
              second: 'main',
              splitPercentage: 20,
            },
          },
          panels: {
            [RoomPanelTypes.enum['data-sources']]: {
              title: 'Data Sources',
              icon: DatabaseIcon,
              component: DataSourcesPanel,
              placement: 'sidebar',
            },
            // [RoomPanelTypes.enum.assistant]: {
            //   title: 'Assistant',
            //   icon: () => null,
            //   component: AssistantPanel,
            //   placement: 'sidebar',
            // },
            main: {
              title: 'Main view',
              icon: () => null,
              component: () =>
                createElement(Suspense, {
                  fallback: createElement(SpinnerPane, {
                    className: 'h-full w-full',
                  }),
                  children: createElement(MainView),
                }),
              placement: 'main',
            },
          },
        },
      })(set, get, store),

      ...createSqlEditorSlice()(set, get, store),

      ...createCellsSlice({
        cellRegistry: createDefaultCellRegistry(),
        supportedSheetTypes: ['notebook', 'canvas', 'app'],
      })(set, get, store),

      ...createNotebookSlice()(set, get, store),

      ...createCanvasSlice({
        ai: {
          getApiKey: () => runtimeConfig.apiKey || '',
          defaultModel: runtimeConfig.llmModel || 'gpt-4o-mini',
        },
      })(set, get, store),

      ...createWebContainerSlice({
        config: {
          filesTree: {},
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
