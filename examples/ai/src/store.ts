import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  AiSliceConfig,
  AiSliceState,
  createAiSettingsSlice,
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiSettingsConfig,
  createDefaultAiTools,
} from '@sqlrooms/ai';
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
import {createVegaChartTool} from '@sqlrooms/vega';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import EchoToolResult from './components/EchoToolResult';

import {AI_SETTINGS} from './config';
import exampleSessions from './example-sessions.json';
import {createElement, lazy, Suspense} from 'react';
import {SpinnerPane} from '@sqlrooms/ui';

// Lazy loading example to enable code splitting
const LazyMainView = lazy(() =>
  import('./components/MainView').then((m) => ({default: m.MainView})),
);

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
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs<RoomState>(
    {
      name: 'ai-example-app-state-storage',
      version: 1,
      migrate: ((persistedState: unknown) => {
        if (
          typeof persistedState !== 'object' ||
          persistedState === null ||
          !('aiSettings' in persistedState)
        ) {
          return persistedState;
        }

        const defaults = createDefaultAiSettingsConfig(AI_SETTINGS);
        const state = persistedState as Record<string, unknown>;

        return {
          ...state,
          aiSettings: AiSettingsSliceConfig.parse({
            defaults,
            persisted: state.aiSettings,
          }),
        };
      }) as any,
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
            {
              tableName: 'earthquakes',
              type: 'url',
              url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
            },
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
              // Wrap in function to prevent immer from freezing the lazy component (which causes errors)
              component: () =>
                createElement(Suspense, {
                  fallback: createElement(SpinnerPane, {
                    className: 'h-full w-full',
                  }),
                  children: createElement(LazyMainView),
                }),
              placement: 'main',
            },
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

        // Add providerOptions here, e.g. to set reasoningEffort for GPT reasoning models GPT-5.1 GPT-5.2
        // getProviderOptions: () => {
        //   return {
        //     openai: {
        //       reasoningEffort: 'high',
        //     },
        //   };
        // },

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
  ),
);
