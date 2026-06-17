# @sqlrooms/pivot

Slice-driven pivot table UI for SQLRooms, inspired by `react-pivottable` and backed by DuckDB SQL plus Vega-Lite charts.

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
