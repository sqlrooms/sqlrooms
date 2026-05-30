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

## Workspace Resources and Blocks

`@sqlrooms/artifacts` owns addressable workspace resources: tabs, titles, current selection, lifecycle hooks, and layout integration. Use artifacts when a thing should be opened, selected, renamed, deleted, or referenced as a workspace-level object.

`@sqlrooms/blocks` owns shared block contracts and vocabulary. A block is a composable unit of content or behavior that can live inside a container. Blocks should not imply a tab, global selection, or independent workspace lifecycle by themselves.

`@sqlrooms/documents` owns `BlockDocument`: an ordered Tiptap-backed block container for narrative text, images, standalone charts, and host-provided stateful blocks. A Worksheet in the CLI app is a user-facing artifact shell around a `BlockDocument`.

Stateful blocks are feature-backed blocks whose backing state lives in the owning feature slice, such as dashboards in Mosaic, pivots in Pivot, or Markdown documents in Documents. They can also be wrapped as single-block artifacts through `@sqlrooms/artifacts` when the same feature needs to be opened as a workspace tab.

`@sqlrooms/cells` owns executable notebook cells. Treat cells as DAG-aware executable blocks: they overlap conceptually with blocks, but notebook execution order, dependencies, results, and status remain notebook/cell responsibilities.

## AI Tools

Tools use `tool()` from the Vercel AI SDK; renderers are registered separately. See `packages/ai/src/tools/defaultTools.ts` and `examples/ai` for current API.

## Packages

See [docs/packages.md](../docs/packages.md). Categories: Core, Feature, Experimental, Utility.
