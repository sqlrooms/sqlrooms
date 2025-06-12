import {
  AiSliceConfig,
  AiSliceState,
  createAiSlice,
  createDefaultAiConfig,
  getDefaultInstructions,
} from '@sqlrooms/ai';
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShellState,
  StateCreator,
  BaseRoomConfig,
} from '@sqlrooms/room-shell';
import {LayoutTypes, MAIN_VIEW} from '@sqlrooms/room-config';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import {MainView} from './components/MainView';
import {createVegaChartTool} from '@sqlrooms/vega';
import {DataTable} from '@sqlrooms/duckdb';
import exampleSessions from './example-sessions.json';
import EchoToolResult from './components/EchoToolResult';
export const RoomPanelTypes = z.enum([
  'room-details',
  'data-sources',
  'view-configuration',
  MAIN_VIEW,
] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room config for saving
 */
export const AppConfig =
  BaseRoomConfig.merge(AiSliceConfig).merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Room state
 */
type CustomAppState = {
  selectedModel: {
    model: string;
    provider: string;
  };
  setSelectedModel: (model: string, provider: string) => void;
  /** API keys by provider */
  apiKeys: Record<string, string | undefined>;
  setProviderApiKey: (provider: string, apiKey: string) => void;
};
export type AppState = RoomShellState<AppConfig> &
  AiSliceState &
  SqlEditorSliceState &
  CustomAppState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<AppConfig, AppState>(
  persist(
    (set, get, store) => ({
      // Base room slice
      ...createRoomShellSlice<AppConfig>({
        config: {
          layout: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              first: RoomPanelTypes.enum['data-sources'],
              second: MAIN_VIEW,
              splitPercentage: 30,
            },
          },
          dataSources: [
            {
              tableName: 'earthquakes',
              type: 'url',
              url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
            },
          ],
          ...createDefaultAiConfig(
            AiSliceConfig.shape.ai.parse(exampleSessions),
          ),
          ...createDefaultSqlEditorConfig(),
        },
        room: {
          panels: {
            [RoomPanelTypes.enum['data-sources']]: {
              title: 'Data Sources',
              // icon: FolderIcon,
              icon: DatabaseIcon,
              component: DataSourcesPanel,
              placement: 'sidebar',
            },
            main: {
              title: 'Main view',
              icon: () => null,
              component: MainView,
              placement: 'main',
            },
          },
        },
      })(set, get, store),

      // Sql editor slice
      ...createSqlEditorSlice()(set, get, store),

      // Ai slice
      ...createAiSlice({
        getApiKey: (modelProvider: string) => {
          return get()?.apiKeys[modelProvider] || '';
        },
        // Add custom tools
        customTools: {
          // Add the VegaChart tool from the vega package with a custom description
          chart: createVegaChartTool(),

          // Example of adding a simple echo tool
          echo: {
            description: 'A simple echo tool that returns the input text',
            parameters: z.object({
              text: z.string().describe('The text to echo back'),
            }),
            execute: async ({text}: {text: string}) => {
              return {
                llmResult: {
                  success: true,
                  details: `Echo: ${text}`,
                },
              };
            },
            component: EchoToolResult,
          },
        },
        // Example of customizing the system instructions
        getInstructions: (tablesSchema: DataTable[]) => {
          // You can use getDefaultInstructions() and append to it
          const defaultInstructions = getDefaultInstructions(tablesSchema);
          return `${defaultInstructions}. Please be polite and concise.`;
        },
      })(set, get, store),

      selectedModel: {
        model: 'gpt-4o-mini',
        provider: 'openai',
      },
      setSelectedModel: (model: string, provider: string) => {
        set({selectedModel: {model, provider}});
      },
      apiKeys: {
        openai: undefined,
      },
      setProviderApiKey: (provider: string, apiKey: string) => {
        set({
          apiKeys: {...get().apiKeys, [provider]: apiKey},
        });
      },
    }),

    // Persist settings
    {
      // Local storage key
      name: 'ai-example-app-state-storage',
      // Subset of the state to persist
      partialize: (state) => ({
        config: AppConfig.parse(state.config),
        selectedModel: state.selectedModel,
        apiKeys: state.apiKeys,
      }),
    },
  ) as StateCreator<AppState>,
);
