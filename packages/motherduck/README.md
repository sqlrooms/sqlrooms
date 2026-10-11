MotherDuck connector for SQLRooms.

`@sqlrooms/motherduck` exposes a DuckDB connector implementation backed by [`@motherduck/wasm-client`](https://motherduck.com/docs/sql-reference/wasm-client/), so SQLRooms apps can query MotherDuck from the browser.

## Installation

```bash
npm install @sqlrooms/motherduck @sqlrooms/room-shell
```

## Quick start

```tsx
import {createWasmMotherDuckDbConnector} from '@sqlrooms/motherduck';
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';

type RoomState = RoomShellSliceState;

export function createStore(mdToken: string) {
  return createRoomStore<RoomState>((set, get, store) => ({
    ...createRoomShellSlice({
      connector: createWasmMotherDuckDbConnector({
        mdToken,
      }),
    })(set, get, store),
  }));
}
```

## Connector options

`createWasmMotherDuckDbConnector(options)` accepts:

- MotherDuck WASM client connection params (for example `mdToken`)
- optional `initializationQuery` string to run at connector init

## Type guard and advanced access

```ts
import {isWasmMotherDuckDbConnector} from '@sqlrooms/motherduck';

const connector = await roomStore.getState().db.getConnector();
if (isWasmMotherDuckDbConnector(connector)) {
  const connection = connector.getConnection();
  // access low-level MotherDuck WASM connection APIs
}
```

## Example

- MotherDuck cloud query example: https://github.com/sqlrooms/examples/tree/main/query-motherduck
