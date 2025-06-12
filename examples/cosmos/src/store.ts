import {
  createRoomShellSlice,
  createRoomStore,
  RoomShellState,
  BaseRoomConfig,
} from '@sqlrooms/room-shell';
import {LayoutTypes, MAIN_VIEW} from '@sqlrooms/room-config';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon, MapIcon} from 'lucide-react';
import {z} from 'zod';
import DataSourcesPanel from './components/DataSourcesPanel';
import {MainView} from './components/MainView';
import {
  CosmosSliceConfig,
  createCosmosSlice,
  CosmosSliceState,
  createDefaultCosmosConfig,
} from '@sqlrooms/cosmos';

export const RoomPanelTypes = z.enum(['data-sources', MAIN_VIEW] as const);

export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room config for saving
 */
export const AppConfig =
  BaseRoomConfig.merge(SqlEditorSliceConfig).merge(CosmosSliceConfig);

export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Room state
 */
export type AppState = RoomShellState<AppConfig> &
  SqlEditorSliceState &
  CosmosSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<AppConfig, AppState>(
  (set, get, store) => ({
    // Base room slice
    ...createRoomShellSlice<AppConfig>({
      config: {
        layout: {
          type: LayoutTypes.enum.mosaic,
          nodes: MAIN_VIEW,
        },
        dataSources: [
          {
            type: 'url',
            url: 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/Cosmograph/mammals.csv',
            tableName: 'mammals',
          },
        ],
        ...createDefaultSqlEditorConfig(),
        ...createDefaultCosmosConfig(),
      },
      room: {
        panels: {
          [RoomPanelTypes.enum['data-sources']]: {
            title: 'Data Sources',
            icon: DatabaseIcon,
            component: DataSourcesPanel,
            placement: 'sidebar',
          },
          main: {
            title: 'Main view',
            icon: MapIcon,
            component: MainView,
            placement: 'main',
          },
        },
      },
    })(set, get, store),

    // Sql editor slice
    ...createSqlEditorSlice()(set, get, store),

    // Cosmos slice
    ...createCosmosSlice()(set, get, store),
  }),
);
