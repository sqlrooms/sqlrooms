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
import {createRagSlice, createRagTool, RagSliceState} from '@sqlrooms/ai-rag';
import {createOpenAIEmbeddingProvider} from './embeddings';
import {
  BaseRoomConfig,
  createPersistHelpers,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  LayoutTypes,
  MAIN_VIEW,
  RoomShellSliceState,
  StateCreator,
} from '@sqlrooms/room-shell';
import {
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
  persist(
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
      // Uses in-memory database for document embeddings
      ...createRagSlice({
        embeddingsDatabases: [
          // User-uploaded documents database (in-memory)
          {
            databaseName: 'user_docs',
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
          const baseInstructions = createDefaultAiInstructions(store);
          return `${baseInstructions}

## Document Search (RAG)

You have access to a \`search_documentation\` tool that searches through uploaded documents using semantic search.

When users ask about documents they've uploaded (PDFs, markdown, text files), USE the search_documentation tool to find relevant content. The tool searches the "user_docs" database containing all uploaded documents.

Example: If a user asks "explain the paper" or "what does the document say about X", use:
- search_documentation with a relevant query

Always search first before saying you don't have access to documents.`;
        },

        // Add custom tools
        tools: {
          ...createDefaultAiTools(store, {query: {}}),

          // RAG tool - search through documentation
          search_documentation: createRagTool(),

          // Add the VegaChart tool from the vega package with a custom description
          chart: createVegaChartTool(),

          // Example of adding a simple echo tool
          echo: {
            name: 'echo',
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
      })(set, get, store),
    }),

    // Persist settings
    {
      // Local storage key
      name: 'ai-example-app-state-storage',
      // Helper to extract and merge slice configs
      ...createPersistHelpers({
        room: BaseRoomConfig,
        layout: LayoutConfig,
        ai: AiSliceConfig,
        aiSettings: AiSettingsSliceConfig,
        sqlEditor: SqlEditorSliceConfig,
      }),
    },
  ) as StateCreator<RoomState>,
);

// Make store available globally for RAG tool
(globalThis as any).__ROOM_STORE__ = roomStore;

export {roomStore, useRoomStore};
