import {
  AiSettingsSliceConfig,
  AiSettingsSliceState,
  AiSliceConfig,
  AiSliceState,
  createAiSettingsSlice,
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiTools,
  QueryToolResult,
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
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {createVegaChartTool, VegaChartToolResult} from '@sqlrooms/vega';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import EchoToolResult from './components/EchoToolResult';

import {AI_SETTINGS} from './config';
import exampleSessions from './example-sessions.json';
import {createElement, lazy, Suspense} from 'react';
import {SpinnerPane} from '@sqlrooms/ui';
import {CityBoundaryTool} from '@openassistant/overture';
import {createDuckdbContext} from '@openassistant/duckdb';

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
    (set, get, store) => {
      // Build the room-shell slice first (this defines `db`), then create any tools
      // that depend on the DuckDB connector. Accessing `store.getState().db` here
      // is too early during store creation and can be undefined.
      const roomShellSlice = createRoomShellSlice({
        connector: createWasmDuckDbConnector({
          initializationQuery: 'LOAD spatial; LOAD httpfs;',
        }),
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
      })(set, get, store);

      // OpenAssistant tools expect a connector that can optionally refresh schemas.
      // SQLRooms exposes schema refresh on the `db` slice, so we provide a tiny wrapper
      // without depending on `store.getState()` during initialization.
      const cityTool = new CityBoundaryTool(
        {
          dbConnector: roomShellSlice.db.connector,
          refreshTableSchemas: async () => {
            await roomShellSlice.db.refreshTableSchemas();
          },
        },
        {refreshTableSchemas: true},
      ).toAISDKv5();

      return {
        // Base room slice
        ...roomShellSlice,

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

          toolComponents: {
            echo: EchoToolResult,
            chart: VegaChartToolResult,
            query: QueryToolResult,
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
              inputSchema: z.object({
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
            },

            // openassistant tool
            cityBoundaryTool: cityTool,
          },
        })(set, get, store),
      };
    },
  ),
);
