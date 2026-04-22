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
import {MessageCircleIcon} from 'lucide-react';
import {z} from 'zod';
import DiscussionPanel from './components/DiscussionPanel';
import {MainView} from './components/MainView';

export const RoomPanelTypes = z.enum(['left', 'discuss', MAIN_VIEW] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export type RoomState = RoomShellSliceState &
  SqlEditorSliceState &
  DiscussSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'discuss-example-app-state-storage',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        sqlEditor: SqlEditorSliceConfig,
        discuss: DiscussSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createDiscussSlice({userId: 'user1'})(set, get, store),

      // Sql editor slice
      ...createSqlEditorSlice()(set, get, store),

      // Room shell slice
      ...createRoomShellSlice({
        connector: createWasmDuckDbConnector({
          initializationQuery: 'LOAD spatial',
        }),
        config: {
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
        layout: {
          config: {
            id: 'root',
            type: 'split',
            direction: 'row',
            children: [
              {
                type: 'tabs',
                id: RoomPanelTypes.enum['left'],
                children: [RoomPanelTypes.enum['discuss']],
                defaultSize: '30%',
                maxSize: '50%',
                minSize: '300px',
                activeTabIndex: 0,
                collapsible: true,
                collapsed: true,
                collapsedSize: 0,
                hideTabStrip: true,
              },
              {
                type: 'panel',
                id: RoomPanelTypes.enum['main'],
              },
            ],
          } satisfies LayoutConfig,
          panels: {
            [RoomPanelTypes.enum['discuss']]: {
              title: 'Discuss',
              icon: MessageCircleIcon,
              component: DiscussionPanel,
            },
            [RoomPanelTypes.enum['main']]: {
              title: 'Main view',
              icon: () => null,
              component: MainView,
            },
          },
        },
      })(set, get, store),
    }),
  ),
);
