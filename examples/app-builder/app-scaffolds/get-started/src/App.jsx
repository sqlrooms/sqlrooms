import {createDuckDbSlice, useSql} from '@sqlrooms/duckdb';
import {
  createRoomSlice,
  createRoomStore,
  RoomStateProvider,
} from '@sqlrooms/room-store';

const {roomStore, useRoomStore} = createRoomStore((set, get, store) => ({
  ...createRoomSlice()(set, get, store),
  ...createDuckDbSlice({})(set, get, store),
}));

function MyRoom() {
  const queryResult = useSql({
    query: `SELECT 'Hello, world!' as message`,
  });
  const row = queryResult.data?.toArray()[0];
  return row ? `Message: ${row.message}` : 'Loading...';
}

export default function App() {
  return (
    <div style={{fontFamily: 'system-ui', padding: 24}}>
      <h1>SQLRooms in WebContainer</h1>
      <RoomStateProvider roomStore={roomStore}>
        <MyRoom />
      </RoomStateProvider>
    </div>
  );
}
