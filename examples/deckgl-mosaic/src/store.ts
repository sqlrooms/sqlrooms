import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  LayoutTypes,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon, FilterIcon} from 'lucide-react';
import {MainView} from './components/MainView';
import DataSourcesPanel from './components/data-sources/DataSourcesPanel';
import FiltersPanel from './components/filters/FiltersPanel';

export type RoomState = RoomShellSliceState & SqlEditorSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'deckgl-mosaic-example-app-state-storage',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        sqlEditor: SqlEditorSliceConfig,
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
          ...createDefaultSqlEditorConfig(),
          dataSources: [
            {
              tableName: 'earthquakes',
              type: 'url',
              url: 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/earthquakes.parquet',
            },
          ],
        },
        layout: {
          config: {
            type: LayoutTypes.enum.mosaic,
            nodes: 'main',
          },
          panels: {
            data: {
              title: 'Data',
              icon: DatabaseIcon,
              component: DataSourcesPanel,
              placement: 'sidebar',
            },
            filters: {
              title: 'Filters',
              icon: FilterIcon,
              component: FiltersPanel,
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
  ),
);
