---
name: Typed Sheets Architecture
overview: Add sheet types ('notebook', 'canvas', 'cell') to CellsSlice, update view slices to filter by type, and implement DuckDB view naming using user-entered sheet/cell titles.
todos:
  - id: add-sheet-type
    content: Add SheetType enum and type field to SheetSchema in types.ts
    status: completed
  - id: update-cells-slice
    content: "Update CellsSlice: addSheet accepts type, add findSheetIdForCell helper"
    status: completed
  - id: add-validation
    content: Create validation.ts with title uniqueness validation
    status: completed
  - id: update-notebook-slice
    content: "Update NotebookSlice to pass type: notebook and filter sheets"
    status: completed
  - id: update-notebook-ui
    content: Update Notebook.tsx SheetsTabBar to filter notebook sheets only
    status: completed
  - id: update-canvas-slice
    content: "Update CanvasSlice to pass type: canvas and filter sheets"
    status: completed
  - id: update-canvas-ui
    content: Update Canvas.tsx SheetsTabBar to filter canvas sheets only
    status: completed
  - id: duckdb-view-naming
    content: Update execution.ts to use sheet.title as schema and cell.title as view name
    status: completed
  - id: add-migration
    content: "Add migration for existing data to set default type: notebook"
    status: cancelled
---

# Typed Sheets Architecture

## Current State

- Sheets in `CellsSlice` have no `type` field - all views see all sheets
- View metadata stored separately: `notebook.config.sheets[id].meta` and `canvas.config.sheets[id]`
- Tab bars show all sheets regardless of which view is active
- SQL execution creates tables in a fixed schema (`'main'` or `'canvas'`)

## Target Architecture

```mermaid
flowchart TB
    subgraph CellsSlice["CellsSlice (shared)"]
        sheets["sheets: Record<id, Sheet>"]
        data["data: Record<id, Cell>"]
    end
    
    subgraph Sheet["Sheet (with type)"]
        type["type: notebook | canvas | cell"]
        title["title: string (schema name)"]
        cellIds["cellIds: string[]"]
        edges["edges: Edge[]"]
    end
    
    subgraph NotebookSlice["NotebookSlice"]
        nbMeta["config.sheets[id].meta"]
        nbFilter["filters: type === notebook"]
    end
    
    subgraph CanvasSlice["CanvasSlice"]
        cvMeta["config.sheets[id].nodes/meta"]
        cvFilter["filters: type === canvas"]
    end
    
    sheets --> Sheet
    NotebookSlice --> |reads/writes| CellsSlice
    CanvasSlice --> |reads/writes| CellsSlice
```



## Changes

### Phase 1: Add Sheet Type to CellsSlice

**File: [packages/cells/src/types.ts](packages/cells/src/types.ts)**Add `SheetType` enum and update `SheetSchema`:

```typescript
export const SheetTypeSchema = z.enum(['notebook', 'canvas', 'cell']);
export type SheetType = z.infer<typeof SheetTypeSchema>;

export const SheetSchema = z.object({
  id: z.string(),
  type: SheetTypeSchema,  // NEW
  title: z.string(),
  cellIds: z.array(z.string()).default([]),
  edges: z.array(EdgeSchema).default([]),
});
```

**File: [packages/cells/src/cellsSlice.ts](packages/cells/src/cellsSlice.ts)**

- Update `addSheet` to accept `type` parameter (default: `'notebook'`)
- Update `addCell` to set `type` when auto-creating sheets
- Add helper selectors: `getSheetsByType(type)`

### Phase 2: Update NotebookSlice to Filter by Type

**File: [packages/notebook/src/NotebookSlice.ts](packages/notebook/src/NotebookSlice.ts)**

- `addTab`: Pass `type: 'notebook'` to `cells.addSheet()`
- Add `getNotebookSheets()` selector that filters `cells.config.sheets` by `type === 'notebook'`
- Update all sheet operations to only work on notebook-type sheets

**File: [packages/notebook/src/Notebook.tsx](packages/notebook/src/Notebook.tsx)**

- Update `SheetsTabBar` to filter `sheetOrder` to only show notebook sheets
- Add UI to create new notebook sheets

### Phase 3: Update CanvasSlice to Filter by Type

**File: [packages/canvas/src/CanvasSlice.ts](packages/canvas/src/CanvasSlice.ts)**

- When adding nodes, ensure sheet is created with `type: 'canvas'`
- Add `getCanvasSheets()` selector
- Update all sheet operations to only work on canvas-type sheets

**File: [packages/canvas/src/Canvas.tsx](packages/canvas/src/Canvas.tsx)**

- Update `SheetsTabBar` to filter to canvas sheets only
- Add UI to create new canvas sheets

### Phase 4: DuckDB View Naming with User-Entered Names

**File: [packages/cells/src/execution.ts](packages/cells/src/execution.ts)**Currently uses fixed `schemaName` parameter. Update to:

1. Get sheet title from `cells.config.sheets[sheetId].title` for schema name
2. Use `cell.data.title` for view/table name
3. Create VIEWs instead of TABLEs for lazy evaluation
```typescript
// Find sheet for this cell
const sheetId = findSheetIdForCell(state, cellId);
const sheet = state.cells.config.sheets[sheetId];

const schemaName = escapeId(sheet.title);  // User-entered sheet name
const viewName = escapeId(cell.data.title); // User-entered cell name

await connector.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
await connector.query(`CREATE OR REPLACE VIEW ${schemaName}.${viewName} AS ${sql}`);
```


**File: [packages/cells/src/cellsSlice.ts](packages/cells/src/cellsSlice.ts)**

- Add `findSheetIdForCell(cellId)` helper function
- Update `runCell` to pass the sheet context to execution

**Validation (new file): [packages/cells/src/validation.ts](packages/cells/src/validation.ts)**

- `validateCellTitle(title, sheetId, cells)`: Ensure unique within sheet
- `validateSheetTitle(title, sheets)`: Ensure unique across sheets
- Call validation in `renameCell` and `renameSheet`

### Phase 5: Update Examples

**File: [examples/notebook/src/store.ts](examples/notebook/src/store.ts)**

- No changes needed - notebook will auto-create sheets with `type: 'notebook'`

**File: [examples/canvas/src/store.ts](examples/canvas/src/store.ts)**

- No changes needed - canvas will auto-create sheets with `type: 'canvas'`

## Migration Notes

- Existing persisted data without `type` field will need a migration
- Default `type` to `'notebook'` for backwards compatibility
- Add migration in persistence layer to add `type` field to existing sheets

## Files to Modify