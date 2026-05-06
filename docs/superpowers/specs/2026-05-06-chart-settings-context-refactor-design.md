---
date: 2026-05-06
title: Chart Settings Context Refactor
status: approved
---

# Chart Settings Context Refactor

## Summary

Refactor all chart-type settings components to use `useChartSettingsContext()` instead of explicit props, standardizing the API to match the pattern established by `HistogramSettings.tsx`.

## Background

Currently, most chart settings components accept explicit props (`columns`, `values`, `onChange`), while `HistogramSettings` uses the context-based approach. This inconsistency creates two patterns in the codebase and makes the component API less cohesive with the compound component pattern used by `ChartSettings`.

## Goals

1. Standardize all chart settings components to use context
2. Remove prop-based interfaces for settings components
3. Update type definitions to reflect the new signature
4. Maintain type safety with discriminated union extraction

## Design

### Architecture

**Context Pattern:**

- `ChartSettingsProvider` wraps the entire chart settings UI
- Individual settings components call `useChartSettingsContext(chartType)` to access typed context
- The hook uses TypeScript's discriminated union extraction to provide type-safe access to chart-specific config

**Component Signature:**

```typescript
// Before
export const BubbleChartSettingsComponent: FC<BubbleChartSettingsComponentProps> = ({
  columns,
  values,
  onChange,
}) => { ... }

// After
export const BubbleChartSettingsComponent: FC = () => {
  const {columns, config, onChange} = useChartSettingsContext('bubble-chart');
  // config.settings is now typed as BubbleChartSettings
  ...
}
```

### Components to Refactor

1. **BubbleChartSettings.tsx**
   - Remove `BubbleChartSettingsComponentProps` interface
   - Use `useChartSettingsContext('bubble-chart')`
   - Access `config.settings.x` and `config.settings.y`

2. **BoxPlotSettings.tsx**
   - Remove `BoxPlotSettingsComponentProps` interface
   - Use `useChartSettingsContext('box-plot')`
   - Access `config.settings.x` and `config.settings.y`

3. **CountPlotSettings.tsx**
   - Remove `CountPlotSettingsComponentProps` interface
   - Use `useChartSettingsContext('count-plot')`
   - Access `config.settings.field`

4. **EcdfSettings.tsx**
   - Remove `EcdfSettingsComponentProps` interface
   - Use `useChartSettingsContext('ecdf')`
   - Access `config.settings.field`

5. **HeatmapSettings.tsx**
   - Remove `HeatmapSettingsComponentProps` interface
   - Use `useChartSettingsContext('heatmap')`
   - Access `config.settings.x` and `config.settings.y`

6. **LineChartSettings.tsx**
   - Remove `LineChartSettingsComponentProps` interface
   - Use `useChartSettingsContext('line-chart')`
   - Access `config.settings.x`, `config.settings.yFields`, `config.settings.xInterval`

7. **CustomSpecSettings.tsx**
   - Remove `CustomSpecSettingsComponentProps` interface
   - Use `useChartSettingsContext('custom-spec')` (or omit if no access needed)
   - Component already has no interactive fields

### Type Definition Updates

**Update `base-types.ts`:**

```typescript
// Before
export interface ChartSettingsComponentProps<TSettings = any> {
  columns: ChartBuilderColumn[];
  values: TSettings;
  onChange: (values: TSettings) => void;
}

export interface ChartTypeDefinition<TSettings = any> {
  // ...
  settingsComponent: FC<ChartSettingsComponentProps<TSettings>>;
}

// After
export interface ChartTypeDefinition<TSettings = any> {
  // ...
  settingsComponent: FC; // No props, uses context
}
```

Remove `ChartSettingsComponentProps` as it's no longer used.

**Update `ChartSettings.tsx`:**

```typescript
// Before (lines 140-146)
const SettingsComponent = chartTypeDef.settingsComponent;
return (
  <SettingsComponent
    columns={mappedColumns}
    values={config.settings}
    onChange={handleSettingsChange}
  />
);

// After
const SettingsComponent = chartTypeDef.settingsComponent;
return <SettingsComponent />;
```

Remove `mappedColumns` and `handleSettingsChange` as they're no longer needed (context provides this).

### Data Flow

1. `ChartSettings.Root` receives config, columns, onChange from parent
2. `ChartSettingsProvider` provides these via context
3. `ChartSettings.Fields` renders the appropriate settings component
4. Settings component calls `useChartSettingsContext(chartType)` to get typed access
5. Component calls `onChange` with updated config (entire config object, not just settings)

### Error Handling

The context hook already validates:

- Context must exist (throws if used outside provider)
- Chart type matches (throws if mismatch)

No additional error handling needed in individual components.

### Testing Strategy

1. Verify each component renders without props
2. Verify type safety: `config.settings` has correct type per chart
3. Verify onChange updates the full config object
4. Manual testing: open chart builder UI, change each chart type, modify fields

## Implementation Steps

1. Update `base-types.ts` - remove `ChartSettingsComponentProps`, update `ChartTypeDefinition`
2. Refactor each settings component (7 components)
3. Update `ChartSettings.tsx` - simplify `ChartSettingsFields` render
4. Remove unused imports and interfaces
5. Build and test

## Non-Goals

- Backward compatibility with prop-based usage (breaking change is acceptable for internal components)
- Changing the context API itself (it already works well)
- Refactoring other chart-builder components beyond settings

## Risks

**Risk:** External code outside the package uses these components directly with props
**Mitigation:** These are internal to `@sqlrooms/mosaic` and not documented as public API

**Risk:** Type errors if discriminated union doesn't extract correctly
**Mitigation:** TypeScript will catch this at compile time; the pattern is already proven with HistogramSettings
