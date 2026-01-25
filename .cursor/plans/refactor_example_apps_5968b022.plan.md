---
name: Refactor Example Apps
overview: Simplify the notebook example to only support notebooks, enhance sqlrooms-cli-ui with both notebook and canvas support, and add missing createCellsSlice to canvas-sync example.
todos:
  - id: simplify-notebook-store
    content: Remove canvas slice from examples/notebook/src/store.ts, set supportedSheetTypes to notebook-only
    status: completed
  - id: simplify-notebook-panel
    content: Simplify NotebookPanel.tsx to render Notebook directly without SheetsTabBar
    status: completed
  - id: update-notebook-package
    content: Remove @sqlrooms/canvas from examples/notebook/package.json
    status: completed
  - id: add-cli-deps
    content: Add @sqlrooms/cells, @sqlrooms/notebook, @sqlrooms/canvas to sqlrooms-cli-ui/package.json
    status: completed
  - id: update-cli-store
    content: Add cells, notebook, and canvas slices to sqlrooms-cli-ui/src/store.ts
    status: completed
  - id: create-cli-sheets-panel
    content: Create SheetsPanel.tsx component for sqlrooms-cli-ui with SheetsTabBar and view switching
    status: completed
  - id: add-canvas-sync-cells
    content: Add @sqlrooms/cells and createCellsSlice to examples/canvas-sync
    status: completed
---

# Refactor Example Apps for Sheet Types

## 1. Simplify `examples/notebook` to Notebook-Only

The notebook example currently supports both notebooks and canvas via `SheetsTabBar`. Simplify it to only support notebooks.**Files to modify:**

- [`examples/notebook/src/store.ts`](examples/notebook/src/store.ts):
- Remove `createCanvasSlice`, `CanvasSliceState`, `CanvasSliceConfig` imports and usage
- Change `supportedSheetTypes` from `['notebook', 'canvas']` to `['notebook']`
- Remove `CanvasSliceConfig` from `createPersistHelpers`
- Remove `CanvasSliceState` from `RoomState` type
- [`examples/notebook/src/NotebookPanel.tsx`](examples/notebook/src/NotebookPanel.tsx):
- Remove `SheetsTabBar` - notebooks will be the only sheet type
- Remove Canvas import and conditional rendering
- Simplify to just render `<Notebook />` directly
- [`examples/notebook/package.json`](examples/notebook/package.json):
- Remove `@sqlrooms/canvas` dependency

## 2. Add Notebook + Canvas Support to `apps/sqlrooms-cli-ui`

Currently, sqlrooms-cli-ui only has AI chat functionality. Add full notebook and canvas support like the current notebook example.**Files to modify:**

- [`apps/sqlrooms-cli-ui/package.json`](apps/sqlrooms-cli-ui/package.json):
- Add dependencies: `@sqlrooms/cells`, `@sqlrooms/notebook`, `@sqlrooms/canvas`
- [`apps/sqlrooms-cli-ui/src/store.ts`](apps/sqlrooms-cli-ui/src/store.ts):
- Add imports for cells, notebook, and canvas slices
- Add `CellsSliceState`, `NotebookSliceState`, `CanvasSliceState` to `RoomState`
- Add `createCellsSlice()`, `createNotebookSlice()`, `createCanvasSlice()` calls
- Add `CellsSliceConfig`, `NotebookSliceConfig`, `CanvasSliceConfig` to `sliceConfigSchemas`
- Create new file [`apps/sqlrooms-cli-ui/src/components/SheetsPanel.tsx`](apps/sqlrooms-cli-ui/src/components/SheetsPanel.tsx):
- Similar to current `NotebookPanel` in examples/notebook
- Includes `SheetsTabBar` with notebook/canvas switching
- MainView.tsx should be rendering the SheetsPanel, the current content of MainView should go to AssistantPanel.tsx, and should be listed in the panels passed to createRoomShellSlice as 'assistant' panel



## 3. Add `createCellsSlice` to `examples/canvas-sync`

The canvas-sync example is missing the cells slice which is now required by canvas.**Files to modify:**

- [`examples/canvas-sync/package.json`](examples/canvas-sync/package.json):
- Add `@sqlrooms/cells` dependency
- [`examples/canvas-sync/src/store.ts`](examples/canvas-sync/src/store.ts):