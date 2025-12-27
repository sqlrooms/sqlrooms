import {
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  MAIN_VIEW,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {DatabaseIcon, InfoIcon, MapIcon} from 'lucide-react';
import {z} from 'zod';
import DataSourcesPanel from './components/DataSourcesPanel';
import {MainView} from './components/MainView';
import RoomDetailsPanel from './components/RoomDetailsPanel';
import {createMosaicSlice} from '@sqlrooms/mosaic';
import {MosaicSliceState} from '@sqlrooms/mosaic/dist/MosaicSlice';

export const RoomPanelTypes = z.enum([
  'room-details',
  'data-sources',
  'data-tables',
  'docs',
  MAIN_VIEW,
] as const);

export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

/**
 * Room state
 */
export type RoomState = RoomShellSliceState &
  MosaicSliceState &
  SqlEditorSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    // Base room slice
    ...createRoomShellSlice({
      config: {
        title: 'Demo App Room',
        dataSources: [
          {
            type: 'url',
            url: 'https://idl.uw.edu/mosaic-datasets/data/observable-latency.parquet',
            tableName: 'latency',
          },
        ],
        ...createDefaultSqlEditorConfig(),
      },
      layout: {
        config: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'row',
            first: RoomPanelTypes.enum['data-sources'],
            second: MAIN_VIEW,
            splitPercentage: 30,
          },
        },
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

    ...createMosaicSlice()(set, get, store),

    // Sql editor slice
    ...createSqlEditorSlice()(set, get, store),
  }),
);
