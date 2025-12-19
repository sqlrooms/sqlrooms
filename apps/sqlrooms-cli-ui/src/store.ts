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
import {createWebSocketDuckDbConnector} from '@sqlrooms/duckdb';
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
import {createVegaChartTool} from '@sqlrooms/vega';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {createElement, Suspense} from 'react';
import {SpinnerPane} from '@sqlrooms/ui';

import {createDuckDbPersistStorage, uploadFileToServer} from './serverApi';
import {fetchRuntimeConfig} from './runtimeConfig';
import {MainView} from './components/MainView';
import {DataSourcesPanel} from './components/DataSourcesPanel';

export const RoomPanelTypes = z.enum([
  'room-details',
  'data-sources',
  'view-configuration',
  MAIN_VIEW,
] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export type RoomState = RoomShellSliceState &
  AiSliceState &
  SqlEditorSliceState &
  AiSettingsSliceState;

const runtimeConfig = await fetchRuntimeConfig();

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

const store = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'sqlrooms-cli-app-state',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        ai: AiSliceConfig,
        aiSettings: AiSettingsSliceConfig,
        sqlEditor: SqlEditorSliceConfig,
      },
      storage: createDuckDbPersistStorage(connector),
    },
    (set, get, store) => ({
      ...createRoomShellSlice({
        connector,
        config: {
          dataSources: [],
        },
        layout: {
          config: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              first: RoomPanelTypes.enum['data-sources'],
              second: MAIN_VIEW,
              splitPercentage: 30,
            },
          },
          panels: {
            [RoomPanelTypes.enum['data-sources']]: {
              title: 'Data Sources',
              icon: DatabaseIcon,
              component: DataSourcesPanel,
              placement: 'sidebar',
            },
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

export const roomStore: any = store.roomStore;
export const useRoomStore = store.useRoomStore;
