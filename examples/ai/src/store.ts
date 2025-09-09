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
import {
  createAiChatUiSlice,
  AiChatUiSliceConfig,
  createDefaultAiChatUiConfig,
  AiChatUiState,
} from '@sqlrooms/ai-chatui';
import {DEFAULT_MODEL, LLM_MODELS} from './models';

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

export type RoomState = RoomShellSliceState<RoomConfig> &
  AiSliceState &
  SqlEditorSliceState &
  AiChatUiState;

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
          ...createDefaultAiChatUiConfig({
            models: LLM_MODELS.reduce((acc: Record<string, any>, provider) => {
              acc[provider.name] = {
                provider: provider.name,
                baseUrl: 'https://api.openai.com/v1',
                apiKey: '',
                models: provider.models.map((model) => ({
                  id: model,
                  modelName: model,
                })),
              };
              return acc;
            }, {}),
            selectedModelId: DEFAULT_MODEL,
          }),
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
            const {models, selectedModelId} = state.config.aiChatUi;
            if (!selectedModelId) return '';

            // Find the model across all providers
            for (const providerKey in models) {
              const provider = models[providerKey];
              if (provider) {
                const model = provider.models.find(
                  (model) => model.id === selectedModelId,
                );
                if (model) {
                  return provider.apiKey || '';
                }
              }
            }
            return '';
          } else {
            return state.config.aiChatUi.customModel.apiKey;
          }
        },
        toolsOptions: {
          // Configure number of rows to share with LLM globally
          numberOfRowsToShareWithLLM: 0,
        },
        // Get max steps from ai-chatui config or default to 5
        maxSteps: get()?.config?.aiChatUi?.modelParameters?.maxSteps || 5,
        // Get base URL from ai-chatui config or default to empty string
        getBaseUrl: () => {
          const state = get();

          if (state.config.aiChatUi.type === 'custom') {
            return state.config.aiChatUi.customModel.baseUrl;
          }

          // Find the model across all providers
          for (const providerKey in state.config.aiChatUi.models) {
            const provider = state.config.aiChatUi.models[providerKey];
            if (provider) {
              const model = provider.models.find(
                (model) => model.id === state.config.aiChatUi.selectedModelId,
              );
              if (model) {
                return provider.baseUrl;
              }
            }
          }
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
          const defaultInstructions = getDefaultInstructions(tablesSchema);
          const customInstructions =
            get().config.aiChatUi.modelParameters.additionalInstruction;

          if (customInstructions) {
            return `${defaultInstructions}\n\nAdditional Instructions:\n\n${customInstructions}`;
          }
          return defaultInstructions;
        },
      })(set, get, store),
    }),

    // Persist settings
    {
      // Local storage key
      name: 'ai-example-app-state-storage',
      // Subset of the state to persist
      partialize: (state) => {
        return {
          config: RoomConfig.parse(state.config),
        };
      },
    },
  ) as StateCreator<RoomState>,
);
