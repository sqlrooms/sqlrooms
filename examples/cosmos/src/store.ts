import {CosmosSliceState, createCosmosSlice} from '@sqlrooms/cosmos';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  MAIN_VIEW,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {createSqlEditorSlice, SqlEditorSliceState} from '@sqlrooms/sql-editor';
import {DatabaseIcon, MapIcon} from 'lucide-react';
import {z} from 'zod';
import DataSourcesPanel from './components/DataSourcesPanel';
import {MainView} from './components/MainView';

export const RoomPanelTypes = z.enum(['data-sources', MAIN_VIEW] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room config for saving
 */

/**
 * Room state
 */
export type RoomState = RoomShellSliceState &
  SqlEditorSliceState &
  CosmosSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    // Base room slice
    ...createRoomShellSlice({
      config: {
        dataSources: [
          {
            type: 'url',
            url: 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/Cosmograph/mammals.csv',
            tableName: 'mammals',
          },
        ],
      },
      layout: {
        config: {
          type: LayoutTypes.enum.mosaic,
          nodes: MAIN_VIEW,
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
