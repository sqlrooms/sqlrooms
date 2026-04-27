React Flow-based artifact-scoped canvas for building SQL + Vega node DAGs in SQLRooms apps.

This package includes:

- `createCanvasSlice` for artifact-scoped canvas runtime state
- `createDefaultCanvasConfig` for persisted config defaults
- `Canvas` React component, which requires an explicit `artifactId`
- `CanvasSliceConfig`, `CanvasNodeMeta`, and `CanvasArtifactMeta` schemas/types

Refer to the [Canvas example](https://github.com/sqlrooms/examples/tree/main/canvas).

## Stable vs internal imports

Use root imports from `@sqlrooms/canvas` as the stable API surface.

- stable: `createCanvasSlice`, `createDefaultCanvasConfig`, `Canvas`, `CanvasSliceConfig`, `CanvasNodeMeta`, `CanvasArtifactMeta`
- internal: direct imports from implementation files under `src/` are not semver-stable and may change without notice
