import {
  AiSliceConfig,
  AiSliceState,
  createAiSlice,
  createDefaultAiConfig,
  getDefaultInstructions,
} from '@sqlrooms/ai';
import {
  createProjectSlice,
  createProjectStore,
  ProjectState,
  StateCreator,
} from '@sqlrooms/project-builder';
import {
  BaseProjectConfig,
  LayoutTypes,
  MAIN_VIEW,
} from '@sqlrooms/project-config';
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
export const ProjectPanelTypes = z.enum([
  'project-details',
  'data-sources',
  'view-configuration',
  MAIN_VIEW,
] as const);
export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;

/**
 * Project config for saving
 */
export const AppConfig =
  BaseProjectConfig.merge(AiSliceConfig).merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Project state
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
export type AppState = ProjectState<AppConfig> &
  AiSliceState &
  SqlEditorSliceState &
  CustomAppState;

/**
 * Create a customized project store
 */
export const {projectStore, useProjectStore} = createProjectStore<
  AppConfig,
  AppState
>(
  persist(
    (set, get, store) => ({
      // Base project slice
      ...createProjectSlice<AppConfig>({
        config: {
          layout: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              first: ProjectPanelTypes.enum['data-sources'],
              second: MAIN_VIEW,
              splitPercentage: 30,
            },
          },
          dataSources: [
            {
              tableName: 'earthquakes',
              type: 'url',
              // url: 'https://gist.githubusercontent.com/curran/a08a1080b88344b0c8a7/raw/0e7a9b0a5d22642a06d3d5b9bcbad9890c8ee534/iris.csv',
              url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
            },
          ],
          ...createDefaultAiConfig(
            AiSliceConfig.shape.ai.parse(exampleSessions),
          ),
          ...createDefaultSqlEditorConfig(),
        },
        project: {
          panels: {
            [ProjectPanelTypes.enum['data-sources']]: {
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
      name: 'app-state-storage',
      // Subset of the state to persist
      partialize: (state) => ({
        config: AppConfig.parse(state.config),
        selectedModel: state.selectedModel,
        apiKeys: state.apiKeys,
      }),
    },
  ) as StateCreator<AppState>,
);
