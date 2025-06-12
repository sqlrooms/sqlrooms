import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomShellStore,
  RoomShellState,
} from '@sqlrooms/room-shell';
import {MapIcon} from 'lucide-react';
import {z} from 'zod';
import {MainView} from './components/MainView';

/**
 * Room config schema is the part of the app state meant for saving.
 */
export const AppConfig = BaseRoomConfig.extend({
  // Add your room config here
});
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * The whole app state.
 */
export type AppState = RoomShellState<AppConfig> & {
  // Add your app state here
};

/**
 * Create the room store. You can combine your custom state and logic
 * with the slices from the SQLRooms modules.
 */
export const {roomStore, useRoomStore} = createRoomShellStore<
  AppConfig,
  AppState
>((set, get, store) => ({
  ...createRoomShellSlice<AppConfig>({
    config: {
      title: 'Minimal SQLRooms App',
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
        // For the minimal example we only define the main panel, no side panels
        main: {
          title: 'Main view',
          icon: MapIcon,
          component: MainView,
          placement: 'main',
        },
      },
    },
  })(set, get, store),
}));
