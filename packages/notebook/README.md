# @sqlrooms/notebook

Artifact-scoped notebook UI and Zustand slice for SQL/text/markdown/vega/input cells in SQLRooms apps.

- NotebookSlice stores per-artifact notebook metadata under `config.artifacts`
- SQL cells create DuckDB views in schema `notebook` using the cell name
- Cell execution cascades to dependents when definitions change
- Pluggable cell renderers supported via `createNotebookSlice()`

## Installation

```bash
pnpm add @sqlrooms/notebook
```

## API

### Config

- `createDefaultNotebookConfig(partial?)` → default `config.notebook`
- Zod schemas: `NotebookSliceConfig`, `NotebookCell`, `NotebookArtifact`, `NotebookArtifactMeta`

### Slice

```ts
createNotebookSlice({});
```

Requires a store that also includes `@sqlrooms/duckdb` slice for `db.sqlSelectToJson` and `db.getConnector`.

Notebook actions under `notebook`:

- `ensureArtifact(artifactId)`, `removeArtifact(artifactId)`
- `addCell(artifactId, type)`, `moveCell(artifactId, cellId, direction)`
- `removeCell(cellId)`, `renameCell(cellId, name)`, `updateCell(cellId, updater)`
- `runCell(cellId, opts?)`, `runAllCells(artifactId)`, `runAllCellsCascade(artifactId)`, `cancelRunCell(cellId)`

SQL cells must contain a single `SELECT` statement. Validation is performed via `get().db.sqlSelectToJson(lastQueryStatement)`. Successful execution creates or replaces a DuckDB view in schema `notebook` named after the cell.

Dependencies are inferred from `sqlSelectToJson` and basic name references; when a cell runs, dependent SQL cells are re-run unless `cascade` is disabled.

### UI

`Notebook` is exported from the package root and requires an explicit `artifactId`.

```tsx
<Notebook artifactId="notebook-1" />
```

The host app owns artifact titles and selection. SQL, Text, Markdown, Vega, Pivot, and Input cells are supported out of the box.

## Stable vs internal imports

Use root imports from `@sqlrooms/notebook` as the stable API surface.

- stable: `createNotebookSlice`, `createDefaultNotebookConfig`, `Notebook`, `useStoreWithNotebook`, exported schema types
- internal: direct imports from implementation files under `src/` are not semver-stable and may change without notice
