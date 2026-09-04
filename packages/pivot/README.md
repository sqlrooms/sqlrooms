# @sqlrooms/pivot

Slice-driven pivot table UI for SQLRooms, inspired by `react-pivottable` and backed by DuckDB SQL plus Vega-Lite charts.

## Setup

Compose `createPivotSlice()` with a room store that includes database state,
persist `PivotSliceConfig`, ensure a pivot instance, then render it by ID:

```tsx
import {PivotSliceConfig, PivotView, createPivotSlice} from '@sqlrooms/pivot';
import {
  createRoomShellSlice,
  createRoomStore,
  persistSliceConfigs,
} from '@sqlrooms/room-shell';

const {roomStore} = createRoomStore(
  persistSliceConfigs(
    {
      name: 'pivot-workspace',
      sliceConfigSchemas: {
        pivot: PivotSliceConfig,
      },
    },
    (set, get, store) => ({
      ...createRoomShellSlice({})(set, get, store),
      ...createPivotSlice()(set, get, store),
    }),
  ),
);

roomStore.getState().pivot.ensurePivot('sales-pivot', {
  title: 'Sales by region',
  source: {kind: 'table', tableName: 'sales'},
});
```

```tsx
<PivotView pivotId="sales-pivot" />
```

The table must be available in the room database catalog before `PivotView`
can render. See the
[Pivot example](https://github.com/sqlrooms/sqlrooms/tree/main/examples/pivot)
for artifact lifecycle and layout integration.

## Selection model

- `createPivotSlice` manages pivot definitions and runtime state, but not host-level selection.
- Host apps should decide which pivot is visible, for example with layout tabs or an artifacts/workspace registry.
- `PivotView` now requires an explicit `pivotId` prop.

## Stateful block adapter

`createPivotBlockDefinition` exposes pivot tables as stateful block
implementations. Host apps can use this definition directly in block hosts or
wrap it as a top-level artifact shell with `@sqlrooms/artifacts`.

```tsx
import {createArtifactTypeFromStatefulBlock} from '@sqlrooms/artifacts';
import {createPivotBlockDefinition} from '@sqlrooms/pivot';

const pivotBlockDefinition = createPivotBlockDefinition();

export const pivotArtifactType =
  createArtifactTypeFromStatefulBlock(pivotBlockDefinition);
```

The adapter preserves pivot state in `pivot.config.pivots` and delegates
creation, rename, and delete behavior to `createPivotSlice`.

See [Blocks and Block Documents](https://sqlrooms.org/blocks-and-documents) for
embedding pivots in rich documents and choosing an ownership mode.
