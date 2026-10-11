Status: **reserved / placeholder package name**.

At the moment, SQLRooms does not publish a separate DuckDB config-schema package from this directory.

## What to use instead

Use these packages for DuckDB setup and config persistence:

- `@sqlrooms/duckdb` for DuckDB slices/connectors
- `@sqlrooms/room-config` and `@sqlrooms/layout-config` for persisted room/layout schemas

## Typical DuckDB setup in a Room store

```tsx
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {createRoomShellSlice, createRoomStore} from '@sqlrooms/room-shell';

const {roomStore} = createRoomStore((set, get, store) => ({
  ...createRoomShellSlice({
    connector: createWasmDuckDbConnector(),
  })(set, get, store),
}));
```

If this package becomes an official published module in the future, this README will be updated with its concrete schemas and exports.
