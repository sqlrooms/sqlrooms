import {useSql} from '@sqlrooms/duckdb';
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShell,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {Spinner} from '@sqlrooms/ui';

/**
 * The whole room state.
 */
export type RoomState = RoomShellSliceState & {
  // Add your app state here
};

/**
 * Create the room store. You can combine your custom state and logic
 * with the slices from the SQLRooms modules.
 */
const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      config: {
        dataSources: [
          {
            type: 'url',
            url: 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/earthquakes.parquet',
            tableName: 'earthquakes',
          },
        ],
      },
    })(set, get, store),
  }),
);

export const Room = () => (
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
