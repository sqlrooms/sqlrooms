# Chart Icons to Definitions Design

**Date:** 2026-05-11  
**Status:** Approved

## Overview

Move chart icons from the centralized `chart-builders/builders.ts` file into individual chart type definitions. Icons will be co-located with their chart definitions in `chart-types/{name}/definition.ts` files.

## Current State

- Icons are defined in a `defaultChartTypeIcons` map in `chart-builders/builders.ts`
- Chart definitions live in `chart-types/{name}/definition.ts` without icon information
- `createChartBuilderTemplate()` combines a `ChartTypeDefinition` with an icon to create a `ChartBuilderTemplate`
- The `ChartBuilderTypeGrid` component renders icons from `ChartBuilderTemplate.icon`

## Goals

- Co-locate icons with their chart definitions for better discoverability
- Maintain backward compatibility
- Keep fallback icon behavior for chart types without explicit icons
- No changes required to consuming components

## Design

### Type Changes

**File:** `packages/mosaic/src/chart-types/base-types.ts`

Add optional `icon` property to `ChartTypeDefinition`:

```typescript
export interface ChartTypeDefinition<TSettings = any> {
  id: VgPlotChartType;
  label?: string;
  description: string;
  schema: z.ZodType<TSettings>;
  createSpec: (tableName: string, values: TSettings) => Spec;
  createTool?: (deps: ChartToolDeps) => Tool;
  buildTitle?: (fieldValues: Record<string, unknown>) => string;
  isAvailable?: (columns: ChartBuilderColumn[]) => boolean;
  aiDescription?: string;
  settingsComponent: FC;
  icon?: ComponentType<{className?: string}>; // NEW
}
```

### Chart Definition Updates

Each chart definition file adds an icon import and property:

**Example:** `packages/mosaic/src/chart-types/histogram/definition.ts`

```typescript
import {BarChart3} from 'lucide-react';
// ... other imports

export const histogramChartType: ChartTypeDefinition<HistogramChartSettings> = {
  id: 'histogram',
  label: 'Histogram',
  description: DESCRIPTION,
  icon: BarChart3, // NEW
  schema: HistogramChartSettings,
  settingsComponent: HistogramSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createTool: createHistogramAiTool,
  createSpec: createHistogramSpec,
};
```

**Icon mappings (from existing code):**

- `count-plot` → `BarChartHorizontal`
- `histogram` → `BarChart3`
- `line-chart` → `LineChart`
- `ecdf` → `TrendingUp`
- `heatmap` → `Grid3X3`
- `box-plot` → `AlignHorizontalDistributeCenter`
- `bubble-chart` → `Workflow` (aliased as `BubblesIcon`)
- `custom-spec` → `Code`

### Builder Updates

**File:** `packages/mosaic/src/chart-builders/builders.ts`

Remove the `defaultChartTypeIcons` map and update `createChartBuilderTemplate()`:

```typescript
export function createChartBuilderTemplate(
  chartType: ChartTypeDefinition,
  icon?: ComponentType<{className?: string}>,
): ChartBuilderTemplate {
  return {
    ...chartType,
    icon: icon ?? chartType.icon ?? ChartNoAxesCombined,
  };
}
```

**Logic:** Use provided icon argument, fall back to `chartType.icon`, then fall back to `ChartNoAxesCombined`.

Update `createChartBuilderTemplates()` to remove icon lookup:

```typescript
export function createChartBuilderTemplates(
  chartTypes: ChartTypeDefinition[],
): ChartBuilderTemplate[] {
  return chartTypes.map((chartType) => createChartBuilderTemplate(chartType));
}
```

Individual builder exports become simpler (icon comes from definition):

```typescript
export const histogramBuilder = createChartBuilderTemplate(histogramChartType);
export const lineChartBuilder = createChartBuilderTemplate(lineChartChartType);
// etc.
```

### ChartBuilderTemplate Interface

**File:** `packages/mosaic/src/chart-builders/types.ts`

The `ChartBuilderTemplate` interface already extends `ChartTypeDefinition` and adds `icon`. Since `icon` is now optional on the base type but required on the template, keep it explicit:

```typescript
export interface ChartBuilderTemplate extends ChartTypeDefinition {
  /** Icon component (required for templates, optional in definitions) */
  icon: ComponentType<{className?: string}>;
}
```

This ensures `ChartBuilderTemplate.icon` is always present (non-optional) for UI consumers.

### Data Flow

**Before:**

1. `ChartTypeDefinition` created without icon
2. Icon looked up from `defaultChartTypeIcons` map
3. `createChartBuilderTemplate(def, icon)` combines them
4. `ChartBuilderTemplate` has icon for UI

**After:**

1. `ChartTypeDefinition` created with icon
2. `createChartBuilderTemplate(def)` uses `def.icon` or fallback
3. `ChartBuilderTemplate` has icon for UI

### No Changes Required

- `ChartBuilderTypeGrid` continues to read `template.icon` as before
- Consuming code that uses `mosaicChartBuilders` or `createDefaultChartBuilders()` sees no API changes
- The `toChartTypeDefinition()` helper automatically strips the icon when converting templates back to definitions (no update needed since icon is now part of the base type)

## Migration Path

1. Add optional `icon` property to `ChartTypeDefinition` interface
2. Update all 8 chart definitions to include their icons
3. Update `createChartBuilderTemplate()` to use icon from definition
4. Remove `defaultChartTypeIcons` map
5. Simplify individual builder exports

## Testing

- Verify all charts display correct icons in `ChartBuilderTypeGrid`
- Verify fallback icon works for any chart type without explicit icon
- Run existing chart builder tests
- Check that custom chart types (user-defined) work without icons

## Files to Modify

1. `packages/mosaic/src/chart-types/base-types.ts` - add optional icon property
2. `packages/mosaic/src/chart-types/count-plot/definition.ts` - add icon
3. `packages/mosaic/src/chart-types/histogram/definition.ts` - add icon
4. `packages/mosaic/src/chart-types/line-chart/definition.ts` - add icon
5. `packages/mosaic/src/chart-types/ecdf/definition.ts` - add icon
6. `packages/mosaic/src/chart-types/heatmap/definition.ts` - add icon
7. `packages/mosaic/src/chart-types/box-plot/definition.ts` - add icon
8. `packages/mosaic/src/chart-types/bubble-chart/definition.ts` - add icon
9. `packages/mosaic/src/chart-types/custom-spec/definition.ts` - add icon
10. `packages/mosaic/src/chart-builders/builders.ts` - remove map, update functions

## Benefits

- Icons co-located with chart definitions for easier discovery
- Single source of truth for each chart's icon
- Easier to add new chart types (icon in same file as definition)
- Maintains backward compatibility
- No breaking changes to public API
