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
export const RoomConfig = BaseRoomConfig.extend({
  // Add custom config here
});
export type RoomConfig = z.infer<typeof RoomConfig>;

/**
 * Room state
 */
export type RoomState = RoomShellSliceState<RoomConfig> & {
  // Add custom state type definitions here (fields and methods)
};

/**
 * Create a customized room store
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice<RoomConfig>({
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
