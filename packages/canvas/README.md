ReactFlow-based canvas for building and editing DAGs of SQL and Vega nodes, with a Zustand slice for persistence in SQLRooms apps.

- CanvasSlice stores nodes and edges under `canvas.config`
- Canvas component renders and edits the graph

Refer to the [Canvas example](https://github.com/sqlrooms/examples/tree/main/canvas).

## Stable vs internal imports

Use root imports from `@sqlrooms/canvas` as the stable API surface.

- stable: `createCanvasSlice`, `createDefaultCanvasConfig`, `Canvas`, `CanvasSliceConfig`, `CanvasNodeMeta`, `CanvasSheetMeta`
- internal: direct imports from implementation files under `src/` are not semver-stable and may change without notice
