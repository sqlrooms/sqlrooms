# Adding Features

> When: adding a new package, visualization, or modifying DuckDB schema.

## Adding a New Feature Package

1. Create the package directory: `packages/my-feature/`
2. Copy `package.json` from a similar package (e.g. `packages/utils/`) and update `name`, `description`, and entry points
3. pnpm workspaces auto-detects it via the `packages/*` glob in `pnpm-workspace.yaml`
4. Create a slice: `export const createMyFeatureSlice = () => (set, get, store) => ({...})`
5. Export the state type: `export type MyFeatureSliceState = {...}`
6. Add a TypeDoc config (`typedoc.json`) if the package has a public API

## Choosing the Right Surface

Use a slice when the feature owns persisted or coordinated state. Most non-trivial features still start here: the slice is the source of truth, and UI, commands, blocks, and artifacts should delegate to it.

Use an artifact when the feature needs workspace identity: tab presence, title, current selection, open/close/delete/rename lifecycle, layout integration, or AI context as a first-class workspace object.

Use a stateful block when the feature should be embedded inside a `BlockDocument` but still needs backing slice state. Define the block contract in the feature package, then let the host app register it with `@sqlrooms/documents`. If the same feature also needs a tab, wrap the same stateful block definition with the artifact bridge instead of maintaining a separate artifact implementation.

Use a document block when the state belongs to the `BlockDocument` content itself, such as paragraphs, headings, lists, image references, or standalone chart configuration. Keep document blocks portable and command-friendly.

Use a cell when the unit participates in notebook execution: dependencies, DAG ordering, query/result ownership, execution status, or notebook-scoped variables. Do not make a generic block executable unless it explicitly participates in the notebook model.

Use a panel when the feature is an app surface or tool area, not a persisted workspace resource. Panels can render artifacts or blocks, but panel registration alone should not become the state model.

## Modifying DuckDB Schema

1. Update schema types in the `duckdb-core` package (`src/types.ts`)
2. If data source handling changes, update the loader in `room-shell`
3. Update `db.addTable()` or `db.loadTableSchemas()` in the `duckdb` slice as needed

## Adding a New Visualization

1. Create `packages/my-viz/`
2. Implement a slice with viz state
3. Create React components that consume `useRoomStore`
4. Add to an example app under `examples/` to demonstrate usage

## Adding Documentation Media (Git LFS)

`docs/public/media/` uses Git LFS. Before adding screenshots or video:

```bash
brew install git-lfs   # macOS
git lfs install
git lfs pull
```

Then add media files normally — LFS handles them automatically.
