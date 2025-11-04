import {
  createDiscussSlice,
  DiscussSliceConfig,
  DiscussSliceState,
} from '@sqlrooms/discuss';
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
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
import {MessageCircleIcon} from 'lucide-react';
import {z} from 'zod';
import {persist} from 'zustand/middleware';
import DiscussionPanel from './components/DiscussionPanel';
import {MainView} from './components/MainView';

export const RoomPanelTypes = z.enum([
  'data-sources',
  'discuss',
  MAIN_VIEW,
] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export const RoomConfig = BaseRoomConfig.merge(SqlEditorSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

export type RoomState = RoomShellSliceState<RoomConfig> &
  SqlEditorSliceState &
  DiscussSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  persist(
    (set, get, store) => ({
      ...createDiscussSlice({userId: 'user1'})(set, get, store),

      // Sql editor slice
      ...createSqlEditorSlice()(set, get, store),

      // Room shell slice
      ...createRoomShellSlice<RoomConfig>({
        connector: createWasmDuckDbConnector({
          initializationQuery: 'LOAD spatial',
        }),
        config: {
          layout: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              direction: 'row',
              first: RoomPanelTypes.enum['discuss'],
              second: RoomPanelTypes.enum['main'],
              splitPercentage: 30,
            },
          },
          ...createDefaultSqlEditorConfig(),
          dataSources: [
            {
              type: 'url',
              // source: Natural Earth http://www.naturalearthdata.com/ via geojson.xyz
              url: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_airports.geojson',
              tableName: 'airports',
              loadOptions: {
                method: 'st_read',
              },
            },
          ],
        },
        room: {
          panels: {
            [RoomPanelTypes.enum['discuss']]: {
              title: 'Discuss',
              icon: MessageCircleIcon,
              component: DiscussionPanel,
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
    }),

    // Persist settings
    {
      // Local storage key
      name: 'discuss-example-app-state-storage',
      // Subset of the state to persist
      partialize: (state) => ({
        roomConfig: RoomConfig.parse(state.config),
        discussConfig: DiscussSliceConfig.parse(state.discuss.config),
      }),
      // Combining the persisted state with the current one
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        config: RoomConfig.parse(persistedState.roomConfig),
        discuss: {
          ...currentState.discuss,
          config: DiscussSliceConfig.parse(persistedState.discussConfig),
        },
      }),
    },
  ) as StateCreator<RoomState>,
);
