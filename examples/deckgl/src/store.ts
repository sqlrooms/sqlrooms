import {createDefaultDiscussConfig} from '@sqlrooms/discuss';
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {DataPanel} from './components/DataPanel';
import {MainView} from './components/MainView';

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
        layout: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'row',
            first: 'data',
            second: 'main',
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
          data: {
            title: 'Data sources',
            icon: DatabaseIcon,
            component: DataPanel,
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
);
