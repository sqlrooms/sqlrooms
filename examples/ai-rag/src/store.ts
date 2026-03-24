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
  createRagSlice,
  createRagTool,
  ragToolRenderer,
  RagSliceState,
} from '@sqlrooms/ai-rag';
import {createOpenAIEmbeddingProvider} from './embeddings';
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
import {createVegaChartTool, VegaChartToolResult} from '@sqlrooms/vega';
import {tool} from 'ai';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import EchoToolResult from './components/EchoToolResult';
import {MainView} from './components/MainView';
import {AI_SETTINGS} from './config';

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
  AiSettingsSliceState &
  RagSliceState;

/**
 * Create a customized room store
 */
const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'ai-example-app-state-storage',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        ai: AiSliceConfig,
        aiSettings: AiSettingsSliceConfig,
        sqlEditor: SqlEditorSliceConfig,
      },
    },
    (set, get, store) => ({
      // Base room slice
      ...createRoomShellSlice({
        config: {
          dataSources: [
            // {
            //   tableName: 'earthquakes',
            //   type: 'url',
            //   url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
            // },
          ],
        },
        layout: {
          config: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              type: 'split',
              direction: 'row',
              children: [RoomPanelTypes.enum['data-sources'], MAIN_VIEW],
              splitPercentages: [30, 70],
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
              component: MainView,
              placement: 'main',
            },
          },
        },
      })(set, get, store),

      // Sql editor slice
      ...createSqlEditorSlice()(set, get, store),

      // Ai model config slice
      ...createAiSettingsSlice({config: AI_SETTINGS})(set, get, store),

      // RAG slice - semantic search through documentation
      ...createRagSlice({
        embeddingsDatabases: [
          {
            databaseFilePathOrUrl:
              window.location.origin + '/rag/duckdb_docs_openai.duckdb',
            databaseName: 'duckdb_docs',
            // Use OpenAI text-embedding-3-small (must match database preparation)
            // Pass getApiKey to retrieve API key from user settings at runtime
            embeddingProvider: createOpenAIEmbeddingProvider(
              'text-embedding-3-small',
              1536,
              () => get().aiSettings.config.providers?.['openai']?.apiKey,
            ),
            embeddingDimensions: 1536,
          },
        ],
      })(set, get, store),

      // Ai slice
      ...createAiSlice({
        getInstructions: () => {
          return createDefaultAiInstructions(store);
        },

        // Tool renderers for displaying tool results in the UI
        toolRenderers: {
          ...createDefaultAiToolRenderers(),
          chart: VegaChartToolResult,
          search_documentation: ragToolRenderer,
          echo: EchoToolResult,
        },

        // Add custom tools
        tools: {
          ...createDefaultAiTools(store, {query: {}}),

          // RAG tool - search through documentation
          search_documentation: createRagTool(),

          // Add the VegaChart tool from the vega package with a custom description
          chart: createVegaChartTool(),

          // Example of adding a simple echo tool
          echo: tool({
            description: 'A simple echo tool that returns the input text',
            inputSchema: z.object({
              text: z.string().describe('The text to echo back'),
            }),
            execute: async ({text}) => ({
              success: true,
              details: `Echo: ${text}`,
            }),
          }),
        },
      })(set, get, store),
    }),
  ),
);

// Make store available globally for RAG tool
(globalThis as any).__ROOM_STORE__ = roomStore;

export {roomStore, useRoomStore};
