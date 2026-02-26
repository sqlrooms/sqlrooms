React Flow-based canvas for building SQL + Vega node DAGs in SQLRooms apps.

This package includes:

Refer to the [Canvas example](https://github.com/sqlrooms/examples/tree/main/canvas).

## Stable vs internal imports

Use root imports from `@sqlrooms/canvas` as the stable API surface.

- stable: `createCanvasSlice`, `createDefaultCanvasConfig`, `Canvas`, `CanvasSliceConfig`, `CanvasNodeMeta`, `CanvasSheetMeta`
- internal: direct imports from implementation files under `src/` are not semver-stable and may change without notice
