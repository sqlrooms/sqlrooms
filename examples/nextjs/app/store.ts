// import {MainView} from '@/components/main-view';
import {MainView} from '@/components/main-view';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {MapIcon} from 'lucide-react';
import {z} from 'zod';

/**
 * Room config for saving
 */
export const AppConfig = BaseRoomConfig.extend({
  // Add custom config here
});
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * Room state
 */
export type AppState = RoomShellSliceState<AppConfig> & {
  // Add custom state type definitions here (fields and methods)
};

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<AppConfig, AppState>(
  (set, get, store) => ({
    ...createRoomShellSlice<AppConfig>({
      config: {
        title: 'Demo App Room',
        dataSources: [
          {
            tableName: 'earthquakes',
            type: 'url',
            url: 'https://raw.githubusercontent.com/keplergl/kepler.gl-data/refs/heads/master/earthquakes/data.csv',
          },
        ],
      },
      room: {
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
  }),
);
