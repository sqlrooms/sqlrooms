import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {createMosaicSlice} from '@sqlrooms/mosaic';
import {MosaicSliceState} from '@sqlrooms/mosaic/dist/MosaicSlice';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import DataSourcesPanel from './components/data-sources/DataSourcesPanel';
import {MainView} from './components/MainView';
import {
  createMapSettingsSlice,
  MapSettingsConfig,
  MapSettingsSliceState,
} from './MapSettingsSlice';

export const RoomPanelTypes = z.enum(['left', 'data', 'main'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export type RoomState = RoomShellSliceState &
  SqlEditorSliceState &
  MosaicSliceState &
  MapSettingsSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'deckgl-mosaic-example-app-state-storage',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        sqlEditor: SqlEditorSliceConfig,
        mapSettings: MapSettingsConfig,
      },
    },
    (set, get, store) => ({
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
              tableName: 'earthquakes',
              type: 'url',
              url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
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
            [RoomPanelTypes.enum['data']]: {
              title: 'Data',
              icon: DatabaseIcon,
              component: DataSourcesPanel,
            },
            [RoomPanelTypes.enum['main']]: {
              title: 'Main view',
              icon: () => null,
              component: MainView,
            },
          },
        },
      })(set, get, store),

      ...createMosaicSlice()(set, get, store),

      ...createMapSettingsSlice()(set, get, store),
    }),
  ),
);
