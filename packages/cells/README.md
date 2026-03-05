# @sqlrooms/cells

Shared cells model and UI primitives used by notebook and canvas views.

The package owns:

- canonical cell records (`cells.config.data`)
- sheet grouping and ordering (`cells.config.sheets`, `sheetOrder`, `currentSheetId`)
- in-sheet dependency edges and cascade execution
- SQL/result execution helpers and status tracking

## Dependency and schema model

- Dependencies and cascades are **sheet-local** by default.
- Cross-sheet references are only supported via explicit fully qualified SQL names.
- SQL execution resolves to a stable sheet schema namespace; it does not rely on global `USE schema`.
- Unqualified result-name references are resolved to the current sheet namespace during execution.

## Stable public API

Import from package root for stable APIs:

- slice: `createCellsSlice`
- hooks: `useCellsStore`
- helpers: `findSheetIdForCell`, `getSheetsByType`
- SQL helpers: `renderSqlWithInputs`, `findSqlDependencies`, `findSqlDependenciesFromAst`
- UI: `SqlCellContent`, `SqlCellRunButton`, `TextCellContent`, `InputCellContent`, `VegaCellContent`, `SheetsTabBar`
- types/schemas: exports from `types.ts`

## Internal APIs

Avoid importing internal implementation modules directly (for example `dagUtils`, `execution`, or component subpaths). These are not guaranteed to be semver-stable.
