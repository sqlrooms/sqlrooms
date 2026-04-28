# @sqlrooms/pivot

Slice-driven pivot table UI for SQLRooms, inspired by `react-pivottable` and backed by DuckDB SQL plus Vega-Lite charts.

## Selection model

- `createPivotSlice` manages pivot definitions and runtime state, but not host-level selection.
- Host apps should decide which pivot is visible, for example with layout tabs or an artifacts/workspace registry.
- `PivotView` now requires an explicit `pivotId` prop.
