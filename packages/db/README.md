# @sqlrooms/db

DuckDB-centered orchestration for SQLRooms multi-database execution.

Most applications receive this slice through `createRoomShellSlice()`. Use
`createDbSlice()` directly when building a custom room store or connector host.

## Purpose

- Keep DuckDB as the core runtime for SQL execution DAG semantics.
- Register and route connector execution for external engines.
- Aggregate connector catalogs/schemas into one explorer view.
- Materialize non-DuckDB results into core DuckDB with a configurable policy.

## Basic setup

```ts
import {createDbSlice} from '@sqlrooms/db';
import {createBaseRoomSlice, createRoomStore} from '@sqlrooms/room-store';

const {roomStore} = createRoomStore((set, get, store) => ({
  ...createBaseRoomSlice()(set, get, store),
  ...createDbSlice()(set, get, store),
}));

await roomStore.getState().db.initialize();

const result = await roomStore.getState().db.connectors.runQuery({
  sql: 'select 42 as answer',
  queryType: 'arrow',
});
```

The core DuckDB connection is registered automatically. Existing DuckDB APIs,
including `useSql()` and `useDataTable()`, are re-exported from this package.

## Add an external connection

A direct connector runs in the current JavaScript runtime. A bridge delegates
execution to a server when a driver cannot run in the browser.

```ts
import {createHttpDbBridge} from '@sqlrooms/db';

const {db} = roomStore.getState();

db.connectors.registerBridge(createHttpDbBridge({id: 'server', baseUrl: '/'}));
db.connectors.registerConnection({
  id: 'warehouse',
  engineId: 'postgres',
  title: 'Warehouse',
  runtimeSupport: 'server',
  requiresBridge: true,
  bridgeId: 'server',
});

const result = await db.connectors.runQuery({
  connectionId: 'warehouse',
  sql: 'select * from orders',
  queryType: 'arrow',
  materialize: true,
  materializedName: 'orders',
});
```

Arrow results from external connections are materialized into core DuckDB by
default, allowing downstream SQLRooms features to query them through one local
execution graph. Set `materialize: false` when the caller will consume the
returned Arrow table directly.

Use `registerConnector(connectionId, connector)` instead of a bridge when the
connector implements `DbConnector` in the current runtime.

## Notes

- This package is intentionally additive and keeps `@sqlrooms/duckdb` APIs intact.
- Default materialization strategy is strict ephemeral attached database mode.
- `@sqlrooms/db/bridge` and `@sqlrooms/db/connectors/duckdb` are supported
  focused entry points for hosts that do not need the complete root export.
