import {createDefaultDiscussConfig} from '@sqlrooms/discuss';
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {createSqlEditorSlice, SqlEditorSliceState} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {DataPanel} from './components/DataPanel';
import {MainView} from './components/MainView';
import {BUILDINGS_PARQUET_URL, BUILDINGS_TABLE_NAME} from './dataSources';

export type RoomState = RoomShellSliceState & SqlEditorSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createSqlEditorSlice()(set, get, store),
    ...createRoomShellSlice({
      connector: createWasmDuckDbConnector({
        initializationQuery: 'LOAD httpfs; LOAD spatial',
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
        dataSources: [
          {
            type: 'url',
            tableName: BUILDINGS_TABLE_NAME,
            url: BUILDINGS_PARQUET_URL,
            loadOptions: {
              method: 'read_parquet',
              select: [
                'name',
                'class',
                'height',
                'ST_AsWKB(geometry) AS geometry',
              ],
            },
          },
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
            title: 'Map',
            icon: () => null,
            component: MainView,
            placement: 'main',
          },
        },
      },
    })(set, get, store),
  }),
);
