import {
  createRoomShellSlice,
  createRoomStore,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {MapIcon} from 'lucide-react';
import {MainView} from './components/MainView';

/**
 * The whole app state.
 */
export type RoomState = RoomShellSliceState & {
  // Add your custom app state types here
};

/**
 * Create the room store. You can combine your custom state and logic
 * with the slices from the SQLRooms modules.
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
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
      layout: {
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
  }),
);
