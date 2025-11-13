// import {MainView} from '@/components/main-view';
import {MainView} from '@/components/main-view';
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {
  createDefaultSqlEditorConfig,
  createSqlEditorSlice,
  SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import {MapIcon} from 'lucide-react';

/**
 * Room state
 */
export type RoomState = RoomShellSliceState & SqlEditorSliceState;

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      config: {
        title: 'Demo App Room',
        dataSources: [
          {
            tableName: 'earthquakes',
            type: 'url',
            url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
          },
        ],
        ...createDefaultSqlEditorConfig(),
      },
      layout: {
        panels: {
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
