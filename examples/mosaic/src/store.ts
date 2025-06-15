import {
  createRoomShellSlice,
  createRoomStore,
  RoomShellSliceState,
  BaseRoomConfig,
} from '@sqlrooms/room-shell';
import {LayoutTypes, MAIN_VIEW} from '@sqlrooms/room-config';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceConfig,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon, InfoIcon, MapIcon} from 'lucide-react';
import {z} from 'zod';
import DataSourcesPanel from './components/DataSourcesPanel';
import {MainView} from './components/MainView';
import RoomDetailsPanel from './components/RoomDetailsPanel';

export const RoomPanelTypes = z.enum([
  'room-details',
  'data-sources',
  'data-tables',
  'docs',
  MAIN_VIEW,
] as const);

export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room config for saving
 */
export const RoomConfig = BaseRoomConfig.merge(SqlEditorSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

/**
 * Room state
 */
export type RoomState = RoomShellSliceState<RoomConfig> & SqlEditorSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    // Base room slice
    ...createRoomShellSlice<RoomConfig>({
      config: {
        title: 'Demo App Room',
        layout: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'row',
            first: RoomPanelTypes.enum['data-sources'],
            second: MAIN_VIEW,
            splitPercentage: 30,
          },
        },
        dataSources: [
          {
            type: 'url',
            url: 'https://idl.uw.edu/mosaic-datasets/data/observable-latency.parquet',
            tableName: 'latency',
          },
        ],
        ...createDefaultSqlEditorConfig(),
      },
      room: {
        panels: {
          [RoomPanelTypes.enum['room-details']]: {
            title: 'Room Details',
            icon: InfoIcon,
            component: RoomDetailsPanel,
            placement: 'sidebar',
          },
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
  }),
);
