import {
  AiSliceConfig,
  AiSliceState,
  createAiSlice,
  createDefaultAiConfig,
  getDefaultInstructions,
  AiModelSliceConfig,
  AiModelConfigState,
  createAiModelConfigSlice,
  createDefaultAiModelConfig,
  getApiKey,
  getBaseUrl,
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
import {LLM_MODELS, PROVIDER_DEFAULT_BASE_URLS} from './models';

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
  .merge(AiModelSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

export type RoomState = RoomShellSliceState<RoomConfig> &
  AiSliceState &
  SqlEditorSliceState &
  AiModelConfigState;

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
          // initialize ai config and ai model config
          ...(() => {
            const aiConfig = createDefaultAiConfig(
              AiSliceConfig.shape.ai.parse(exampleSessions),
            );
            return {
              ...aiConfig,
              ...createDefaultAiModelConfig(
                {
                  models: LLM_MODELS.reduce(
                    (
                      acc: Record<
                        string,
                        {
                          name: string;
                          baseUrl: string;
                          apiKey: string;
                          models: Array<{id: string; modelName: string}>;
                        }
                      >,
                      provider,
                    ) => {
                      acc[provider.name] = {
                        name: provider.name,
                        baseUrl:
                          PROVIDER_DEFAULT_BASE_URLS[
                            provider.name as keyof typeof PROVIDER_DEFAULT_BASE_URLS
                          ],
                        apiKey: '',
                        models: provider.models.map((model) => ({
                          id: model,
                          modelName: model,
                        })),
                      };
                      return acc;
                    },
                    {},
                  ),
                },
                aiConfig.ai.sessions,
              ),
            };
          })(),
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

      // Ai model config slice
      ...createAiModelConfigSlice()(set, get, store),

      // Ai slice
      ...createAiSlice({
        // Get API key from Ai model config UI or your custom logic
        getApiKey: () => {
          const state = get();
          const currentSessionId = state.config.ai.currentSessionId;
          if (!currentSessionId) return '';
          return getApiKey(currentSessionId, state.config.aiModelConfig);
        },
        toolsOptions: {
          // Configure number of rows to share with LLM globally
          numberOfRowsToShareWithLLM: 0,
        },
        // Get max steps from Ai model config or your default value
        getMaxSteps: () => {
          const state = get();
          return state.config.aiModelConfig.modelParameters.maxSteps || 5;
        },
        // Get base URL from Ai model config or your default value
        getBaseUrl: () => {
          const state = get();
          const currentSessionId = state.config.ai.currentSessionId;
          if (!currentSessionId) return undefined;
          return getBaseUrl(currentSessionId, state.config.aiModelConfig);
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
          // get default instructions from sqlrooms/ai
          let instructions = getDefaultInstructions(tablesSchema);
          // get custom instructions from Ai model config UI
          const customInstructions =
            get().config.aiModelConfig.modelParameters.additionalInstruction;

          if (customInstructions) {
            instructions = `${instructions}\n\nAdditional Instructions:\n\n${customInstructions}`;
          }
          // you can add more instructions here if you want
          instructions = `${instructions}\n\nYour name is George`;
          return instructions;
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
