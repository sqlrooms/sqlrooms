# @sqlrooms/cells

> **Experimental:** This package's API and behavior may change between releases.

Shared cells model and UI primitives used by notebook and canvas views.

The package owns:

- canonical cell records (`cells.config.data`)
- artifact-scoped runtime containers (`cells.config.artifacts`)
- in-artifact dependency edges and cascade execution
- SQL/result execution helpers and status tracking

## Setup

Cells require a room store with database state. Most apps compose them with
`createRoomShellSlice()` and a feature host such as notebook or canvas:

```ts
import {
  CellsSliceConfig,
  createCellsSlice,
  createDefaultCellRegistry,
} from '@sqlrooms/cells';
import {
  createRoomShellSlice,
  createRoomStore,
  persistSliceConfigs,
} from '@sqlrooms/room-shell';

const {roomStore} = createRoomStore(
  persistSliceConfigs(
    {
      name: 'cells-workspace',
      sliceConfigSchemas: {
        cells: CellsSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createRoomShellSlice({})(set, get, store),
      ...createCellsSlice({
        cellRegistry: createDefaultCellRegistry(),
      })(set, get, store),
    }),
  ),
);

roomStore.getState().cells.ensureArtifact('notebook-1');
```

The registry controls which cell types can be created and how they render.
Start with `createDefaultCellRegistry()` and extend it with feature entries such
as `pivotCellRegistryEntry` when needed.

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
