import {CosmosSliceState, createCosmosSlice} from '@sqlrooms/cosmos';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutConfig,
  MAIN_VIEW,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {createSqlEditorSlice, SqlEditorSliceState} from '@sqlrooms/sql-editor';
import {DatabaseIcon, MapIcon} from 'lucide-react';
import {z} from 'zod';
import DataSourcesPanel from './components/DataSourcesPanel';
import {MainView} from './components/MainView';

export const RoomPanelTypes = z.enum(['left', 'data', MAIN_VIEW] as const);

export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

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
            url: 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/Cosmograph/publications/publications-sample-1pct.parquet',
            tableName: 'publications',
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
            icon: MapIcon,
            component: MainView,
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
