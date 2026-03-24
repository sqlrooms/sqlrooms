# Architecture

> When: understanding project structure before making changes.
> See also: [Key Concepts](../docs/key-concepts.md), [Modular Architecture](../docs/modular-architecture.md), [State Management](../docs/state-management.md)

## Slices

Everything is a **slice**: state + actions + lifecycle (`initialize`/`destroy`), created via `createSlice()`, combined via spread into `createRoomStore()`. Common slices: `RoomShellSliceState` (config, files, data sources), `DuckDbSliceState` (tables, queries), `LayoutSliceState` (panels), `SqlEditorSliceState`, `AiSliceState`.

## Room

Combine slices into a typed store:

```typescript
export type RoomState = RoomShellSliceState &
  DuckDbSliceState &
  CustomSliceState;
export const {roomStore, useRoomStore} =
  createRoomStore<RoomState>(stateCreator);
```

## DuckDB

Three packages: `duckdb-core` (platform-agnostic types), `duckdb` (WASM/WebSocket + React hooks: `useSql`, `useDuckDb`), `duckdb-node` (SSR/backend).

## Data Sources

Three types from `room-config`: `{type: 'file'}`, `{type: 'url'}`, `{type: 'sql'}` — each with a `tableName`.

## Panels

React components registered in `layout.panels` with `title`, `icon`, `component`, `placement` (`'sidebar'`|`'main'`). Layout tree uses mosaic. See [Key Concepts](../docs/key-concepts.md).

## AI Tools

Tools use `tool()` from the Vercel AI SDK; renderers are registered separately. See `packages/ai/src/tools/defaultTools.ts` and `examples/ai` for current API.

## Packages

See [docs/packages.md](../docs/packages.md). Categories: Core, Feature, Utility.
