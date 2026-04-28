import {createMosaicSlice} from '@sqlrooms/mosaic';
import {MosaicSliceState} from '@sqlrooms/mosaic/dist/MosaicSlice';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  MAIN_VIEW,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {createSqlEditorSlice, SqlEditorSliceState} from '@sqlrooms/sql-editor';
import {DatabaseIcon, InfoIcon, MapIcon} from 'lucide-react';
import {z} from 'zod';
import {DataSourcesPanel} from './components/DataSourcesPanel';
import {MainView} from './components/MainView';
import {RoomDetailsPanel} from './components/RoomDetailsPanel';

export const RoomPanelTypes = z.enum([
  'room-details',
  'data',
  'data-tables',
  'docs',
  'left',
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
      },
      layout: {
        config: {
          type: 'split',
          id: 'root',
          direction: 'row',
          children: [
            {
              type: 'tabs',
              id: RoomPanelTypes.enum['left'],
              children: [
                RoomPanelTypes.enum['data'],
                RoomPanelTypes.enum['room-details'],
              ],
              defaultSize: '30%',
              minSize: '300px',
              maxSize: '50%',
              activeTabIndex: 0,
              collapsible: true,
              collapsedSize: 0,
              hideTabStrip: true,
            },
            {
              type: 'panel',
              id: RoomPanelTypes.enum['main'],
              panel: RoomPanelTypes.enum['main'],
              defaultSize: '70%',
            },
          ],
        } satisfies LayoutConfig,
        panels: {
          [RoomPanelTypes.enum['room-details']]: {
            title: 'Room Details',
            icon: InfoIcon,
            component: RoomDetailsPanel,
          },
          [RoomPanelTypes.enum['data']]: {
            title: 'Data',
            icon: DatabaseIcon,
            component: DataSourcesPanel,
          },
          [RoomPanelTypes.enum['main']]: {
            title: 'Main view',
            icon: MapIcon,
            component: MainView,
          },
        },
      },
    })(set, get, store),

    ...createMosaicSlice()(set, get, store),

    // Sql editor slice
    ...createSqlEditorSlice()(set, get, store),
  }),
);
