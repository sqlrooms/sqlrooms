import {useSql} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  RoomShell,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {Spinner} from '@sqlrooms/ui';
import {z} from 'zod';

/**
 * Room config schema is the persistable part of the app state meant for saving.
 */
export const AppConfig = BaseRoomConfig.extend({
  // Add your room config here
});
export type AppConfig = z.infer<typeof AppConfig>;

/**
 * The whole room state.
 */
export type AppState = RoomShellSliceState<AppConfig> & {
  // Add your app state here
};

/**
 * Create the room store. You can combine your custom state and logic
 * with the slices from the SQLRooms modules.
 */
export const {roomStore, useRoomStore} = createRoomStore<AppConfig, AppState>(
  (set, get, store) => ({
    ...createRoomShellSlice<AppConfig>({
      config: {},
      room: {
        panels: {},
      },
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
  const queryResult = useSql<{maxMagnitude: number}>({
    query: `
      SELECT max(Magnitude) AS maxMagnitude
      FROM 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/earthquakes.parquet'
    `,
  });
  if (queryResult.error) {
    return <div className="text-red-500">{queryResult.error.message}</div>;
  }
  if (queryResult.isLoading) {
    return <Spinner />;
  }
  const row = queryResult.data?.toArray()[0];
  return (
    <div>
      {row ? `Max earthquake magnitude: ${row.maxMagnitude}` : 'No data'}
    </div>
  );
}
