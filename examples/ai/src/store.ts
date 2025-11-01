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
  QueryEditorPanel,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {createVegaChartTool} from '@sqlrooms/vega';
import {DatabaseIcon, TerminalIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import EchoToolResult from './components/EchoToolResult';
import {MainView} from './components/MainView';
import {AI_SETTINGS} from './config';
import exampleSessions from './example-sessions.json';

export const RoomPanelTypes = z.enum([
  'room-details',
  'data-sources',
  'sql-editor',
  'view-configuration',
  MAIN_VIEW,
] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export type RoomState = RoomShellSliceState &
  AiSliceState &
  SqlEditorSliceState &
  AiSettingsSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persist(
    (set, get, store) => ({
      // Base room slice
      ...createRoomShellSlice({
        config: {
          dataSources: [
            {
              tableName: 'earthquakes',
              type: 'url',
              url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
            },
          ],
          layout: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              first: {
                direction: 'column',
                first: RoomPanelTypes.enum['data-sources'],
                second: RoomPanelTypes.enum['sql-editor'],
                splitPercentage: 50,
              },
              second: MAIN_VIEW,
              splitPercentage: 30,
            },
          },
        },
        room: {
          panels: {
            [RoomPanelTypes.enum['data-sources']]: {
              title: 'Data Sources',
              icon: DatabaseIcon,
              component: DataSourcesPanel,
              placement: 'sidebar',
            },
            [RoomPanelTypes.enum['sql-editor']]: {
              title: 'SQL Editor',
              icon: TerminalIcon,
              component: QueryEditorPanel,
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

      // ...createDuckDbSlice()(set, get, store),

      // ...createLayoutSlice({
      //   config: {
      //     type: LayoutTypes.enum.mosaic,
      //     nodes: {
      //       direction: 'row',
      //       first: RoomPanelTypes.enum['data-sources'],
      //       second: MAIN_VIEW,
      //       splitPercentage: 30,
      //     },
      //   },
      //   panels: {
      //     [RoomPanelTypes.enum['data-sources']]: {
      //       title: 'Data Sources',
      //       icon: DatabaseIcon,
      //       component: DataSourcesPanel,
      //       placement: 'sidebar',
      //     },
      //     main: {
      //       title: 'Main view',
      //       icon: () => null,
      //       component: MainView,
      //       placement: 'main',
      //     },
      //   },
      // })(set, get, store),

      // Sql editor slice
      ...createSqlEditorSlice()(set, get, store),

      // Ai model config slice
      ...createAiSettingsSlice({config: AI_SETTINGS})(set, get, store),

      // Ai slice
      ...createAiSlice({
        config: AiSliceConfig.parse(exampleSessions),

        getInstructions: () => {
          return createDefaultAiInstructions(store);
        },

        // Add custom tools
        tools: {
          ...createDefaultAiTools(store, {query: {}}),

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
