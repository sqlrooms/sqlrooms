# @sqlrooms/cells

Shared cells model and UI primitives used by notebook and canvas views.

The package owns:

- canonical cell records (`cells.config.data`)
- artifact-scoped runtime containers (`cells.config.artifacts`)
- in-artifact dependency edges and cascade execution
- SQL/result execution helpers and status tracking

## Dependency and schema model

- Dependencies and cascades are **artifact-local** by default.
- Cross-artifact references are only supported via explicit fully qualified SQL names.
- SQL execution resolves to a stable artifact schema namespace; it does not rely on global `USE schema`.
- Unqualified result-name references are resolved to the current artifact namespace during execution.

## Stable public API

Import from package root for stable APIs:

- slice: `createCellsSlice`
- hooks: `useCellsStore`
- helpers: `findArtifactIdForCell`, `resolveArtifactSchemaName`
- SQL helpers: `renderSqlWithInputs`, `findSqlDependencies`, `findSqlDependenciesFromAst`
- UI: `SqlCellContent`, `SqlCellRunButton`, `TextCellContent`, `InputCellContent`, `VegaCellContent`, `CellSourceSelector`
- types/schemas: exports from `types.ts`

## Internal APIs

Avoid importing internal implementation modules directly (for example `dagUtils`, `execution`, or component subpaths). These are not guaranteed to be semver-stable.
