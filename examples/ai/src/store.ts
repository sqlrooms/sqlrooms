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
import {createLayoutSlice} from '@sqlrooms/layout';
import {createVegaChartTool} from '@sqlrooms/vega';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import EchoToolResult from './components/EchoToolResult';
import {MainView} from './components/MainView';
import {AI_SETTINGS} from './config';
import exampleSessions from './example-sessions.json';
import {createDuckDbSlice} from '@sqlrooms/duckdb';

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

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<
  BaseRoomConfig,
  RoomState
>(
  persist(
    (set, get, store) => ({
      // Base room slice
      ...createRoomShellSlice({
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
        },
      })(set, get, store),

      ...createDuckDbSlice()(set, get, store),

      ...createLayoutSlice({
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
      })(set, get, store),

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
      // Subset of the state to persist
      partialize: (state) => ({
        config: BaseRoomConfig.parse(state.config),
        ai: AiSliceConfig.parse(state.ai.config),
        aiSettings: AiSettingsSliceConfig.parse(state.aiSettings.config),
        sqlEditor: SqlEditorSliceConfig.parse(state.sqlEditor.config),
      }),
      // Combining the persisted state with the current one when loading from local storage
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        config: BaseRoomConfig.parse(persistedState.config),
        ai: {
          ...currentState.ai,
          config: AiSliceConfig.parse(persistedState.ai),
        },
        aiSettings: {
          ...currentState.aiSettings,
          config: AiSettingsSliceConfig.parse(persistedState.aiSettings),
        },
        sqlEditor: {
          ...currentState.sqlEditor,
          config: SqlEditorSliceConfig.parse(persistedState.sqlEditor),
        },
      }),
    },
  ) as StateCreator<RoomState>,
);
