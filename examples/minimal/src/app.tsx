import {useSql} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  RoomShell,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {Spinner} from '@sqlrooms/ui';
import {useEffect} from 'react';
import {z} from 'zod';

/**
 * Room config schema is the persistable part of the app state meant for saving.
 */
export const RoomConfig = BaseRoomConfig.extend({
  // Add your room config here
});
export type RoomConfig = z.infer<typeof RoomConfig>;

/**
 * The whole room state.
 */
export type RoomState = RoomShellSliceState<RoomConfig> & {
  // Add your app state here
};

/**
 * Create the room store. You can combine your custom state and logic
 * with the slices from the SQLRooms modules.
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice<RoomConfig>({
      config: {
        dataSources: [
          {
            type: 'url',
            url: 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/earthquakes.parquet',
            tableName: 'earthquakes',
          },
        ],
      },
      room: {},
    })(set, get, store),
  }),
);

export const App = () => (
  <RoomShell
    className="flex h-screen w-screen items-center justify-center"
    roomStore={roomStore}
  >
    <MyComponent />
  </RoomShell>
);

function MyComponent() {
  const isTableReady = useRoomStore((state) =>
    Boolean(state.db.findTableByName('earthquakes')),
  );
  const queryResult = useSql<{maxMagnitude: number}>({
    query: `SELECT max(Magnitude) AS maxMagnitude FROM earthquakes`,
    enabled: isTableReady,
  });
  const row = queryResult.data?.toArray()[0];
  return row ? `Max earthquake magnitude: ${row.maxMagnitude}` : <Spinner />;
}
