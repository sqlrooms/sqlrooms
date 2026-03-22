# Adding Features

> When: adding a new package, visualization, or modifying DuckDB schema.

## Adding a New Feature Package

1. Create the package directory: `packages/my-feature/`
2. Copy `package.json` from a similar package (e.g. `packages/utils/`) and update `name`, `description`, and entry points
3. pnpm workspaces auto-detects it via the `packages/*` glob in `pnpm-workspace.yaml`
4. Create a slice: `export const createMyFeatureSlice = () => (set, get, store) => ({...})`
5. Export the state type: `export type MyFeatureSliceState = {...}`
6. Add a TypeDoc config (`typedoc.json`) if the package has a public API

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
