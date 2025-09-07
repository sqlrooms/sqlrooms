import {
  AiSliceConfig,
  AiSliceState,
  createAiSlice,
  createDefaultAiConfig,
  getDefaultInstructions,
} from '@sqlrooms/ai';
import {DataTable} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  MAIN_VIEW,
  RoomShellSliceState,
  StateCreator,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {createVegaChartTool} from '@sqlrooms/vega';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import EchoToolResult from './components/EchoToolResult';
import {MainView} from './components/MainView';
import exampleSessions from './example-sessions.json';
import {DEFAULT_MODEL} from './models';
import {
  createAiChatUiSlice,
  AiChatUiSliceConfig,
  createDefaultAiChatUiConfig,
  AiChatUiState,
} from '@sqlrooms/ai-chatui';

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
export const RoomConfig = BaseRoomConfig.merge(AiSliceConfig)
  .merge(SqlEditorSliceConfig)
  .merge(AiChatUiSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

/**
 * Room state
 */
type CustomRoomState = {
  selectedModel: {
    model: string;
    provider: string;
  };
  setCustomSelectedModel: (model: string, provider: string) => void;
  /** API keys by provider */
  apiKeys: Record<string, string | undefined>;
  setProviderApiKey: (provider: string, apiKey: string) => void;
};

export type RoomState = RoomShellSliceState<RoomConfig> &
  AiSliceState &
  SqlEditorSliceState &
  AiChatUiState &
  CustomRoomState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  persist(
    (set, get, store) => ({
      // Base room slice
      ...createRoomShellSlice<RoomConfig>({
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
          ...createDefaultAiChatUiConfig({}),
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

      // ai-chatui config slice
      ...createAiChatUiSlice()(set, get, store),

      // Ai slice
      ...createAiSlice({
        getApiKey: () => {
          const state = get();
          if (state.config.aiChatUi.type === 'default') {
            const selectedModel = state.config.aiChatUi.models.find(
              (model) => model.id === state.config.aiChatUi.selectedModelId,
            );
            return selectedModel?.apiKey || '';
          } else {
            return state.config.aiChatUi.customModel.apiKey;
          }
        },
        toolsOptions: {
          // Configure number of rows to share with LLM globally
          numberOfRowsToShareWithLLM: 0,
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
        model: DEFAULT_MODEL,
        provider: 'openai',
      },
      setCustomSelectedModel: (model: string, provider: string) => {
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
      partialize: (state) => {
        const persisted = {
          config: RoomConfig.parse(state.config),
          selectedModel: state.selectedModel,
          apiKeys: state.apiKeys,
        };
        return persisted;
      },
    },
  ) as StateCreator<RoomState>,
);
