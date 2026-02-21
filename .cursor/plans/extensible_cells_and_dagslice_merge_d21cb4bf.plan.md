---
name: Extensible Cells and DagSlice Merge
overview: Remove the unused 'cell' sheet type, make cell types extensible via the registry, and merge DagSlice into CellsSlice for a simpler API.
todos:
  - id: remove-cell-sheettype
    content: Remove 'cell' from SheetType enum in types.ts
    status: completed
  - id: update-sheetstabbar
    content: Remove 'cell' entry from TYPE_ICONS in SheetsTabBar.tsx
    status: in_progress
  - id: extensible-celltype
    content: Replace CellTypes enum with flexible string type in types.ts
    status: pending
  - id: update-notebook-cellschemas
    content: Update cellSchemas.ts to work with flexible cell types
    status: pending
  - id: update-getCellTypeLabel
    content: Make getCellTypeLabel use registry for labels
    status: pending
  - id: update-addnewcelldropdown
    content: Query registry for available cell types in AddNewCellDropdown
    status: pending
  - id: update-addnewcelltabs
    content: Query registry for available cell types in AddNewCellTabs
    status: pending
  - id: merge-dagslice-types
    content: Remove DagSliceState, merge DAG methods into CellsSliceState
    status: pending
  - id: merge-dagslice-impl
    content: Move DAG implementation from dagSlice.ts into cellsSlice.ts
    status: pending
  - id: delete-dagslice
    content: Delete dagSlice.ts file
    status: pending
  - id: update-cells-index
    content: Remove createDagSlice export from index.ts
    status: pending
  - id: update-hooks
    content: Update useCellsStore hook to remove DagSliceState dependency
    status: pending
  - id: update-notebook-hook
    content: Update useStoreWithNotebook to remove DagSliceState
    status: pending
  - id: update-example-stores
    content: Remove createDagSlice() calls from example stores
    status: pending
---

# Extensible Cell Types + DagSlice Merge

## Part 1: Remove 'cell' from SheetType

Since we're using the "View as cells" toggle approach instead of individual cell sheets, remove the unused `'cell'` option.**[packages/cells/src/types.ts](packages/cells/src/types.ts)**

```typescript
// Change from:
export const SheetType = z.enum(['notebook', 'canvas', 'cell']);
// To:
export const SheetType = z.enum(['notebook', 'canvas']);
```

**[packages/cells/src/components/SheetsTabBar.tsx](packages/cells/src/components/SheetsTabBar.tsx)**

- Remove `Square` icon import
- Remove 'cell' entry from `TYPE_ICONS` map

---

## Part 2: Make CellTypes Extensible

Replace hardcoded enum with flexible string type that allows client apps to add custom cell types.**[packages/cells/src/types.ts](packages/cells/src/types.ts)**

```typescript
// Built-in cell types (for autocomplete and documentation)
export type BuiltInCellType = 'sql' | 'text' | 'vega' | 'input';

// Any string allowed - registry validates at runtime
export type CellType = BuiltInCellType | (string & {});

// Keep built-in data schemas exported for convenience (no Schema suffix)
// SqlCellData, TextCellData, VegaCellData, InputCellData
```

**[packages/notebook/src/cellOperations/AddNewCellDropdown.tsx](packages/notebook/src/cellOperations/AddNewCellDropdown.tsx)** and **[AddNewCellTabs.tsx](packages/notebook/src/cellOperations/AddNewCellTabs.tsx)**

- Get available cell types from registry instead of hardcoded enum:
```typescript
const cellRegistry = useStoreWithNotebook((s) => s.cells.cellRegistry);
const availableTypes = Object.keys(cellRegistry);
```


**[packages/notebook/src/NotebookUtils.ts](packages/notebook/src/NotebookUtils.ts)**

```typescript
export const getCellTypeLabel = (type: string, registry?: CellRegistry) => {
  return registry?.[type]?.title ?? type.charAt(0).toUpperCase() + type.slice(1);
};
```

---

## Part 3: Merge DagSlice into CellsSlice

DagSlice is tightly coupled to CellsSlice and always used together. Merge for a simpler API.**[packages/cells/src/types.ts](packages/cells/src/types.ts)**Remove `DagSliceState` type, add DAG methods directly to `CellsSliceState`:

```typescript
export type CellsSliceState = {
  cells: {
    // ...existing cell/sheet CRUD...
    
    // DAG methods (moved from DagSlice)
    getRootCells: (sheetId: string) => string[];
    getDownstream: (sheetId: string, sourceCellId: string) => string[];
    runAllCellsCascade: (sheetId: string) => Promise<void>;
    runDownstreamCascade: (sheetId: string, sourceCellId: string) => Promise<void>;
  };
};
```

**[packages/cells/src/cellsSlice.ts](packages/cells/src/cellsSlice.ts)**Move DAG implementation from `dagSlice.ts` directly into `createCellsSlice`.**[packages/cells/src/dagSlice.ts](packages/cells/src/dagSlice.ts)**Delete this file (code moved to cellsSlice.ts).**[packages/cells/src/index.ts](packages/cells/src/index.ts)**

- Remove `createDagSlice` export

**[packages/cells/src/hooks.ts](packages/cells/src/hooks.ts)**

- Remove `DagSliceState` from `CellsStoreState` type

**[packages/notebook/src/useStoreWithNotebook.ts](packages/notebook/src/useStoreWithNotebook.ts)**

- Remove `DagSliceState` from store type

**Example stores to update:**

- [examples/notebook/src/store.ts](examples/notebook/src/store.ts) - Remove `...createDagSlice()(set, get),` and `DagSliceState` from `RoomState`
- [examples/canvas/src/store.ts](examples/canvas/src/store.ts) - Remove `...createDagSlice()(set, get),` and `DagSliceState` from `RoomState`

---

## Files Summary

- `packages/cells/src/types.ts` - Remove 'cell' SheetType, extensible CellType, merge DagSliceState into CellsSliceState
- `packages/cells/src/cellsSlice.ts` - Add DAG methods inline
- `packages/cells/src/dagSlice.ts` - Delete
- `packages/cells/src/index.ts` - Remove createDagSlice export
- `packages/cells/src/hooks.ts` - Remove DagSliceState
- `packages/cells/src/components/SheetsTabBar.tsx` - Remove 'cell' from TYPE_ICONS
- `packages/notebook/src/useStoreWithNotebook.ts` - Remove DagSliceState