---
name: Extensible Cell Types
overview: Remove the unused 'cell' sheet type and make cell types extensible via the registry, allowing client apps to add custom cell types without modifying the core package.
todos:
  - id: remove-cell-sheettype
    content: Remove 'cell' from SheetTypeSchema enum in types.ts
    status: completed
  - id: update-sheetstabbar
    content: Remove 'cell' entry from TYPE_ICONS in SheetsTabBar.tsx
    status: completed
  - id: extensible-celltype
    content: Replace CellTypes enum with flexible string type in types.ts
    status: completed
  - id: update-cellschema
    content: Update CellSchema to accept any string type (validated by registry)
    status: completed
  - id: update-notebook-cellschemas
    content: Update cellSchemas.ts to work with flexible cell types
    status: completed
  - id: update-getCellTypeLabel
    content: Make getCellTypeLabel use registry for labels
    status: completed
  - id: update-addnewcelldropdown
    content: Query registry for available cell types in AddNewCellDropdown
    status: completed
  - id: update-addnewcelltabs
    content: Query registry for available cell types in AddNewCellTabs
    status: completed
---

# Extensible Cell Types and SheetType Cleanup

## Part 1: Remove 'cell' from SheetType

Since we're using the "View as cells" toggle approach instead of individual cell sheets, remove the unused `'cell'` option.

### Changes:

**[packages/cells/src/types.ts](packages/cells/src/types.ts)**

```typescript
// Change from:
export const SheetTypeSchema = z.enum(['notebook', 'canvas', 'cell']);
// To:
export const SheetTypeSchema = z.enum(['notebook', 'canvas']);
```

**[packages/cells/src/components/SheetsTabBar.tsx](packages/cells/src/components/SheetsTabBar.tsx)**

- Remove `Square` icon import (was for 'cell' type)
- Remove 'cell' entry from `TYPE_ICONS` map

---

## Part 2: Make CellTypes Extensible

The cell type system should derive from the registry rather than a hardcoded enum.

### Current Problem:

```typescript
export const CellTypes = z.enum(['sql', 'text', 'vega', 'input']);
```

This prevents apps from adding custom cell types like `'python'`, `'chart'`, etc.

### Solution: Registry-driven approach

**[packages/cells/src/types.ts](packages/cells/src/types.ts)**

1. Replace the enum with a flexible string type:
```typescript
// Built-in cell types (for autocomplete and documentation)
export type BuiltInCellType = 'sql' | 'text' | 'vega' | 'input';

// Any string allowed - registry validates at runtime
export type CellType = BuiltInCellType | (string & {});

// Zod schema accepts any string (registry is the validator)
export const CellTypeSchema = z.string();
```




2. Update `CellDataSchema` to use `z.string()` for the type field instead of literals:
```typescript
// Change the discriminated union to a more flexible approach
export const CellSchema = z.object({
  id: z.string(),
  type: z.string(),  // Registry validates this
  data: z.record(z.unknown()),  // Each cell type defines its own data shape
});
```




3. Keep built-in data schemas exported for convenience:

- `SqlCellDataSchema`
- `TextCellDataSchema`
- `VegaCellDataSchema`
- `InputCellDataSchema`

**[packages/notebook/src/cellSchemas.ts](packages/notebook/src/cellSchemas.ts)**Update to work with the new flexible type system:

```typescript
import { CellType } from '@sqlrooms/cells';

// For notebook-specific UI, get available types from the registry
export type NotebookCellType = CellType;

// Remove the re-export of CellTypes enum
// Instead, components should query the registry for available types
```

**[packages/notebook/src/NotebookUtils.ts](packages/notebook/src/NotebookUtils.ts)**Update `getCellTypeLabel` to be more dynamic:

```typescript
export const getCellTypeLabel = (type: string, registry?: CellRegistry) => {
  // Use registry title if available, otherwise capitalize
  return registry?.[type]?.title ?? type.charAt(0).toUpperCase() + type.slice(1);
};
```

**[packages/notebook/src/cellOperations/AddNewCellDropdown.tsx](packages/notebook/src/cellOperations/AddNewCellDropdown.tsx)**Get available cell types from the registry:

```typescript
const cellRegistry = useStoreWithNotebook((s) => s.cells.cellRegistry);
const availableTypes = Object.keys(cellRegistry);
```

**[packages/notebook/src/cellOperations/AddNewCellTabs.tsx](packages/notebook/src/cellOperations/AddNewCellTabs.tsx)**Same change - query registry for types:

```typescript
const cellRegistry = useStoreWithNotebook((s) => s.cells.cellRegistry);
const cellTypes = Object.keys(cellRegistry);
```

---

## Usage Example (for custom cell types)

After these changes, apps can add custom cell types:

```typescript
// In app store.ts
const customRegistry = {
  ...createDefaultCellRegistry(),
  python: {
    type: 'python',
    title: 'Python Script',
    createCell: (id) => ({ id, type: 'python', data: { code: '' } }),
    renderCell: ({ id, cell, renderContainer }) => (
      <PythonCell id={id} cell={cell} renderContainer={renderContainer} />
    ),
    findDependencies: () => [],
  },
};

createCellsSlice({ cellRegistry: customRegistry });







```