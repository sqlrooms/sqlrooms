import {useSql} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  RoomShell,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {Spinner, ThemeProvider} from '@sqlrooms/ui';
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
  <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
    <RoomShell className="h-screen" roomStore={roomStore}>
      <MyComponent />
    </RoomShell>
  </ThemeProvider>
);

function MyComponent() {
  const queryResult = useSql<{maxMagnitude: number}>({
    query: `
      SELECT max(Magnitude) AS maxMagnitude
      FROM 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/earthquakes.parquet'
    `,
  });
  const row = queryResult.data?.toArray()[0];
  return (
    <div className="flex h-full w-full items-center justify-center">
      {queryResult.error ? (
        <div className="text-red-500">{queryResult.error.message}</div>
      ) : row ? (
        `Max earthquake magnitude: ${row.maxMagnitude}`
      ) : (
        <Spinner />
      )}
    </div>
  );
}
