# Box Plot Migration to New Architecture

**Date:** 2026-05-11  
**Branch:** feat--Box-plot-for-mosaic-dashboards → main  
**Status:** Design Approved

## Context

The `feat--Box-plot-for-mosaic-dashboards` branch contains a working Box plot implementation using the dashboard-native pattern (custom `BoxPlotClient` + dedicated panel renderer). Meanwhile, the main branch has an old, non-functional Box plot implementation in `/chart-types/box-plot/` that uses a different approach (Vega-Lite spec generation).

### Problem Statement

- Two conflicting Box plot implementations exist across branches
- The old implementation in main doesn't work and needs removal
- The new implementation needs to be integrated cleanly via rebase
- Public API exports need cleanup to remove old box-plot types

### Goals

1. Rebase the feature branch onto main to incorporate latest changes
2. Remove the old broken Box plot implementation from main
3. Ensure the new Box plot follows proper registration patterns
4. Maintain the dashboard-native architecture (BoxPlotClient + custom renderer)
5. Clean up all exports and imports
6. Verify via existing unit tests

### Success Criteria

- Clean linear Git history after rebase
- No old box-plot code remains
- `pnpm build` and `pnpm test` pass
- Box plot properly registered in chart type registry
- No breaking exports from old implementation

---

## Architecture

### Current State (feat branch)

The new Box plot implementation uses the **dashboard-native pattern**:

**Key Components:**

- **Panel Type:** Dedicated `MOSAIC_DASHBOARD_BOXPLOT_PANEL_TYPE = 'boxplot'`
- **Client:** `BoxPlotClient` extends `MosaicClient` for SQL query generation and state management
- **Renderer:** `MosaicDashboardBoxPlotPanelRenderer.tsx` (custom React component)
- **Chart Type:** Definition in `/chart-types/box-plot/definition.ts` with `outputKind: 'dashboard-panel'`
- **Registration:** Proper registration in `registry.ts` and exports in `index.ts`

**File Structure:**

```
packages/mosaic/src/
├── boxplot/
│   └── BoxPlotClient.ts              # Mosaic client with SQL generation
├── dashboard/
│   ├── MosaicDashboardBoxPlotPanelRenderer.tsx  # React renderer
│   ├── MosaicDashboardSlice.ts       # Panel type registration
│   └── defaultPanelRenderers.ts      # Renderer registry
├── chart-types/box-plot/
│   ├── definition.ts                 # Chart type definition
│   └── schema.ts                     # Zod schemas
└── __tests__/
    └── BoxPlotClient.test.ts         # Unit tests
```

### Old Implementation (main branch - to remove)

The old Box plot in main uses a **Vega-Lite spec generation approach** that doesn't work:

**Files to Delete:**

- `/chart-types/box-plot/BoxPlotSettings.tsx`
- `/chart-types/box-plot/definition.ts`
- `/chart-types/box-plot/schema.ts`
- `/chart-types/box-plot/spec.ts`
- `/chart-types/box-plot/tool.ts`

**Exports to Remove:**

- `BoxPlotChartConfig` (old schema)
- `BoxPlotChartSettings` (old settings)
- `createBoxPlotAiTool` (old AI tool)
- `BoxPlotToolParameters`, `BoxPlotToolParams`

**Files with References:**

- `chart-types/chart-config.ts` - Import and union member
- `chart-types/index.ts` - Multiple exports
- `chart-types/registry.ts` - Old registration
- `packages/mosaic/src/index.ts` - Public API exports

---

## Data Flow & Component Structure

### Component Hierarchy

```
ChartTypeDefinition (box-plot/definition.ts)
  ↓
BoxPlotChartConfig (box-plot/schema.ts)
  ↓
MosaicDashboardBoxPlotPanelRenderer.tsx
  ↓
BoxPlotClient.ts (MosaicClient)
  ↓
Observable Plot Rendering
```

### Data Flow

1. **User creates Box plot in dashboard**
   - Chart builder reads `fields` from `boxPlotChartType` definition
   - User selects X (categorical) and Y (numeric) fields
   - Settings validated against `BoxPlotChartSettings` Zod schema

2. **Panel configuration stored**
   - Stored as `BoxPlotChartConfig` with `chartType: 'box-plot'`
   - Includes `settings: {x, y}` and `settingsOpen` flag

3. **Dashboard renders panel**
   - `MosaicDashboardSlice` maps panel type `'boxplot'` to renderer
   - `MosaicDashboardBoxPlotPanelRenderer` instantiated
   - Creates `BoxPlotClient` with connection and coordinator

4. **BoxPlotClient generates SQL**
   - `buildBoxPlotQuery()` creates query with:
     - Quartile calculations (Q1, median, Q3)
     - IQR-based outlier detection (1.5 × IQR)
     - Whisker computation from non-outlier values
     - UNION ALL of summary stats + outlier points

5. **Query results processed**
   - Separates into `summaries` (boxes/whiskers) and `outliers`
   - Updates internal state via `setSummaries()` and `setOutliers()`

6. **Observable Plot renders**
   - `ResponsivePlot` wrapper for sizing
   - Box marks for quartiles
   - Whisker rules for min/max
   - Dot marks for outliers
   - Y-axis brush for interactive filtering

7. **Brushing/filtering**
   - Drag on Y-axis creates brush selection
   - `BoxPlotClient.brushY()` updates Mosaic selection
   - Cross-filtering propagates to other panels

### Key Registrations

- **Chart type:** `registerChartType(boxPlotChartType)` in `registry.ts`
- **Panel renderer:** `defaultPanelRenderers['boxplot'] = mosaicDashboardBoxPlotPanelRenderer`
- **Panel type constant:** `MOSAIC_DASHBOARD_BOXPLOT_PANEL_TYPE = 'boxplot'` in `definition.ts`

---

## Migration Strategy

### Approach: Rebase-First, Then Clean

**Three-Phase Process:**

1. **Phase 1: Rebase** - Integrate main's changes into feature branch
2. **Phase 2: Remove Old Implementation** - Delete old box-plot code and references
3. **Phase 3: Verification** - Ensure build and tests pass

### Expected Rebase Conflicts

1. **`chart-types/registry.ts`**
   - Both branches register `boxPlotChartType`
   - **Resolution:** Keep feat branch's import and registration (points to dashboard-native implementation)

2. **`chart-types/index.ts`**
   - Both export box-plot schemas and definitions
   - **Resolution:** Keep feat branch's exports (new schema structure)

3. **`chart-types/chart-config.ts`**
   - Both import `BoxPlotChartConfig` in discriminated union
   - **Resolution:** Keep feat branch's import (points to new schema)

4. **Main `index.ts`**
   - Main may have added new exports between branches
   - **Resolution:** Accept main's new exports, but skip old box-plot exports

---

## Implementation Steps

### 1. Pre-rebase Verification

```bash
# Confirm feat branch builds
pnpm build

# Confirm tests pass
pnpm test

# Note current commit
git log -1 --oneline
```

### 2. Perform Rebase

```bash
# Fetch latest main
git fetch origin main

# Rebase feature branch onto main
git rebase origin/main
```

**For each conflict:**

- Open file in editor
- Keep feat branch's box-plot implementation
- Remove main's old box-plot references
- Stage resolved file: `git add <file>`
- Continue: `git rebase --continue`

### 3. Post-rebase Cleanup

**Important:** The new implementation ALSO has files in `chart-types/box-plot/` (definition.ts, schema.ts). During rebase conflicts, we keep the NEW files and reject the OLD files. If the entire directory was deleted during conflict resolution, the new files need to be restored from the feature branch.

**After rebase, verify which box-plot implementation remains:**

```bash
# Check if new box-plot files exist (should be present)
ls -la packages/mosaic/src/chart-types/box-plot/

# Should see: definition.ts, schema.ts (new implementation)
# Should NOT see: BoxPlotSettings.tsx, spec.ts, tool.ts (old implementation)
```

**If old files still exist, remove them manually:**

```bash
# Remove old files ONLY if they exist
rm -f packages/mosaic/src/chart-types/box-plot/BoxPlotSettings.tsx
rm -f packages/mosaic/src/chart-types/box-plot/spec.ts
rm -f packages/mosaic/src/chart-types/box-plot/tool.ts
```

**Clean up imports/exports in:**

- `chart-types/chart-config.ts` - Remove old `BoxPlotChartConfig` import
- `chart-types/index.ts` - Remove old box-plot exports
- `packages/mosaic/src/index.ts` - Remove old public API exports

**Files to edit:**

`chart-types/chart-config.ts`:

- Remove: `import {BoxPlotChartConfig} from './box-plot/schema';` (old import)
- Keep: Import from new schema if not already present

`chart-types/index.ts`:

- Remove lines 29, 39, 49, 62 (old box-plot exports)
- Remove old `boxPlotChartType` from exports (if duplicate)

`packages/mosaic/src/index.ts`:

- Remove: `BoxPlotChartSettings`, `BoxPlotToolParameters`, `createBoxPlotAiTool`, `BoxPlotToolParams`

### 4. Verification

```bash
# TypeScript compilation
pnpm build

# Type checking
pnpm typecheck

# Run tests (specifically BoxPlotClient tests)
pnpm test
```

All commands must pass.

### 5. Commit Cleanup Changes

```bash
git add .
git commit -m "chore: remove old box plot implementation after rebase"
```

### Rollback Plan

If rebase fails catastrophically:

```bash
git rebase --abort
```

Returns to pre-rebase state. Can then try alternative approach or manual conflict resolution.

---

## Testing Strategy

**Automated Tests:**

- Run existing `BoxPlotClient.test.ts` unit tests
- Verify SQL query generation is correct
- Confirm quartile calculations and outlier detection

**Build Verification:**

- `pnpm build` - Confirms TypeScript compilation
- `pnpm typecheck` - Validates type safety
- No lint errors (warnings acceptable per CLAUDE.md)

**Manual Testing (Optional):**

- Start example app: `pnpm dev mosaic-example`
- Create Box plot visualization
- Verify rendering, brushing, and cross-filtering

---

## Critical Files

### Files Modified During Migration

| File                           | Change                                  |
| ------------------------------ | --------------------------------------- |
| `chart-types/registry.ts`      | Resolve conflict, keep new registration |
| `chart-types/index.ts`         | Resolve conflict, keep new exports      |
| `chart-types/chart-config.ts`  | Resolve conflict, keep new import       |
| `packages/mosaic/src/index.ts` | Remove old box-plot exports             |

### Files Deleted

| File                                       | Reason             |
| ------------------------------------------ | ------------------ |
| `chart-types/box-plot/BoxPlotSettings.tsx` | Old implementation |
| `chart-types/box-plot/definition.ts`       | Old implementation |
| `chart-types/box-plot/schema.ts`           | Old implementation |
| `chart-types/box-plot/spec.ts`             | Old implementation |
| `chart-types/box-plot/tool.ts`             | Old implementation |

### Files Preserved (New Implementation)

| File                                                | Purpose                       |
| --------------------------------------------------- | ----------------------------- |
| `boxplot/BoxPlotClient.ts`                          | SQL generation, Mosaic client |
| `dashboard/MosaicDashboardBoxPlotPanelRenderer.tsx` | React renderer                |
| `chart-types/box-plot/definition.ts`                | Chart type definition (new)   |
| `chart-types/box-plot/schema.ts`                    | Zod schemas (new)             |
| `__tests__/BoxPlotClient.test.ts`                   | Unit tests                    |

---

## Risk Assessment

### Low Risk

- Rebase conflicts are predictable and isolated to registry/export files
- New implementation is already working on feat branch
- Unit tests provide safety net

### Medium Risk

- Public API breaking change (old exports removed)
  - **Mitigation:** This is internal codebase, no external consumers
- Potential for missing import cleanup
  - **Mitigation:** TypeScript compiler will catch broken imports

### High Risk

- None identified

---

## Future Considerations

### Optional: Migrate to VgPlot Path

The Box plot could eventually be migrated to the VgPlot path (like histogram, line-chart) by:

1. Refactoring `BoxPlotClient` SQL generation into a Mosaic spec generator
2. Removing custom panel renderer
3. Using unified `MosaicDashboardVgPlotPanelRenderer`

**Benefits:**

- Unified architecture with other chart types
- Less code to maintain
- Simpler testing

**Trade-offs:**

- Would lose custom brushing implementation
- More complex initial refactor
- Current dashboard-native approach works well

**Recommendation:** Keep dashboard-native for now, revisit if VgPlot gains box plot support in Mosaic specs.

---

## Success Metrics

- [ ] Rebase completes successfully
- [ ] All old box-plot files deleted
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (BoxPlotClient tests)
- [ ] No broken imports/exports
- [ ] Box plot properly registered in chart type registry
- [ ] Clean Git history (linear, no merge commits)

---

## References

- **CLAUDE.md:** Architecture patterns, component API patterns, table interop
- **Current Branch:** feat--Box-plot-for-mosaic-dashboards
- **Target Branch:** main
- **Related Commits:**
  - `e2419e2b` - feat: Box plot for mosaic dashboards (main implementation)
  - `38ecc157` - fix: avoid box plot chart type circular import
