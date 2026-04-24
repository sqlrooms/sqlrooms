import {createDefaultDiscussConfig} from '@sqlrooms/discuss';
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {createSqlEditorSlice, SqlEditorSliceState} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {DataPanel} from './components/DataPanel';
import {MainView} from './components/MainView';
import {z} from 'zod';

export const RoomPanelTypes = z.enum(['left', 'data', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export type RoomState = RoomShellSliceState & SqlEditorSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    // Sql editor slice
    ...createSqlEditorSlice()(set, get, store),

    // Room shell slice
    ...createRoomShellSlice({
      connector: createWasmDuckDbConnector({
        initializationQuery: 'LOAD spatial',
      }),
      config: {
        ...createDefaultDiscussConfig(),
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
              children: [RoomPanelTypes.enum['data']],
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
              panel: RoomPanelTypes.enum['main'],
            },
          ],
        } satisfies LayoutConfig,
        panels: {
          data: {
            title: 'Data',
            icon: DatabaseIcon,
            component: DataPanel,
          },
          main: {
            title: 'Main view',
            icon: () => null,
            component: MainView,
          },
        },
      },
    })(set, get, store),
  }),
);
