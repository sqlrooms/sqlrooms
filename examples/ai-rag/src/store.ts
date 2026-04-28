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
  RagSliceState,
  ragToolRenderer,
} from '@sqlrooms/ai-rag';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
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
import {createOpenAIEmbeddingProvider} from './embeddings';

export const RoomPanelTypes = z.enum([
  'left',
  'room-details',
  'data',
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
            id: 'root',
            type: 'split',
            direction: 'row',
            children: [
              {
                type: 'tabs',
                id: RoomPanelTypes.enum['left'],
                children: [RoomPanelTypes.enum['data']],
                defaultSize: '20%',
                maxSize: '50%',
                minSize: '300px',
                activeTabIndex: 0,
                collapsible: true,
                collapsedSize: 0,
                hideTabStrip: true,
              },
              {
                type: 'panel',
                id: RoomPanelTypes.enum['main'],
                panel: RoomPanelTypes.enum['main'],
                defaultSize: '80%',
              },
            ],
          } satisfies LayoutConfig,
          panels: {
            [RoomPanelTypes.enum['data']]: {
              title: 'Data',
              icon: DatabaseIcon,
              component: DataSourcesPanel,
            },
            [RoomPanelTypes.enum['main']]: {
              title: 'Main view',
              icon: () => null,
              component: MainView,
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
