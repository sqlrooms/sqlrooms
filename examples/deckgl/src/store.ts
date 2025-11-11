import {
  createDefaultDiscussConfig,
  DiscussSliceConfig,
} from '@sqlrooms/discuss';
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  MAIN_VIEW,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataPanel} from './components/DataPanel';
import {MainView} from './components/MainView';

export const RoomPanelTypes = z.enum(['data', MAIN_VIEW] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export const RoomConfig =
  BaseRoomConfig.merge(DiscussSliceConfig).merge(SqlEditorSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

export type RoomState = RoomShellSliceState<RoomConfig> & SqlEditorSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    // Sql editor slice
    ...createSqlEditorSlice()(set, get, store),

    // Room shell slice
    ...createRoomShellSlice<RoomConfig>({
      connector: createWasmDuckDbConnector({
        initializationQuery: 'LOAD spatial',
      }),
      config: {
        ...createDefaultDiscussConfig(),
        layout: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'row',
            first: RoomPanelTypes.enum['data'],
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
          [RoomPanelTypes.enum['data']]: {
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
