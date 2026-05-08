# Chart Settings Context Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor all chart-type settings components to use `useChartSettingsContext()` instead of explicit props.

**Architecture:** Remove prop-based interfaces, update each settings component to call `useChartSettingsContext(chartType)`, update type definitions, and simplify the ChartSettings.Fields render logic.

**Tech Stack:** React, TypeScript, Zustand context pattern

---

## File Structure

**Files to modify:**

- `packages/mosaic/src/chart-types/base-types.ts` - Remove ChartSettingsComponentProps, update ChartTypeDefinition
- `packages/mosaic/src/chart-types/bubble-chart/BubbleChartSettings.tsx` - Remove props, use context
- `packages/mosaic/src/chart-types/box-plot/BoxPlotSettings.tsx` - Remove props, use context
- `packages/mosaic/src/chart-types/count-plot/CountPlotSettings.tsx` - Remove props, use context
- `packages/mosaic/src/chart-types/ecdf/EcdfSettings.tsx` - Remove props, use context
- `packages/mosaic/src/chart-types/heatmap/HeatmapSettings.tsx` - Remove props, use context
- `packages/mosaic/src/chart-types/line-chart/LineChartSettings.tsx` - Remove props, use context
- `packages/mosaic/src/chart-types/custom-spec/CustomSpecSettings.tsx` - Remove props, use context
- `packages/mosaic/src/dashboard/chart-settings/ChartSettings.tsx` - Simplify Fields component

---

### Task 1: Update base-types.ts

**Files:**

- Modify: `packages/mosaic/src/chart-types/base-types.ts:52-56`
- Modify: `packages/mosaic/src/chart-types/base-types.ts:80`

- [ ] **Step 1: Read current base-types.ts**

Verify current structure of ChartSettingsComponentProps and ChartTypeDefinition.

- [ ] **Step 2: Remove ChartSettingsComponentProps interface**

Remove lines 49-56 (the ChartSettingsComponentProps interface).

- [ ] **Step 3: Update ChartTypeDefinition.settingsComponent type**

Change line 80 from:

```typescript
settingsComponent: FC<ChartSettingsComponentProps<TSettings>>;
```

To:

```typescript
settingsComponent: FC;
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: Type errors in settings components (expected at this stage)

---

### Task 2: Refactor BubbleChartSettings.tsx

**Files:**

- Modify: `packages/mosaic/src/chart-types/bubble-chart/BubbleChartSettings.tsx`

- [ ] **Step 1: Add context import**

Add to imports at top of file:

```typescript
import {useChartSettingsContext} from '../../dashboard/chart-settings/ChartSettingsContext';
```

- [ ] **Step 2: Remove old imports and interface**

Remove:

```typescript
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {BubbleChartSettings} from './schema';

export interface BubbleChartSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: BubbleChartSettings;
  onChange: (values: BubbleChartSettings) => void;
}
```

Keep the import for schema type (needed for type checking).

- [ ] **Step 3: Refactor component to use context**

Replace the entire component with:

```typescript
export const BubbleChartSettingsComponent: FC = () => {
  const {columns, onChange, config} = useChartSettingsContext('bubble-chart');

  const updateField = useCallback(
    (key: keyof BubbleChartSettings, value: any) => {
      onChange({
        ...config,
        settings: {
          ...config.settings,
          [key]: value,
        },
      });
    },
    [config, onChange],
  );

  return (
    <div className="space-y-4">
      <FieldSelector label="X Field" required>
        <ColumnSelector
          columns={columns}
          types={NUMERIC_COLUMN_TYPES}
          value={config.settings.x}
          onChange={(x) => updateField('x', x)}
        />
      </FieldSelector>

      <FieldSelector label="Y Field" required>
        <ColumnSelector
          columns={columns}
          types={NUMERIC_COLUMN_TYPES}
          value={config.settings.y}
          onChange={(y) => updateField('y', y)}
        />
      </FieldSelector>
    </div>
  );
};
```

- [ ] **Step 4: Verify imports are correct**

Ensure these imports remain:

```typescript
import {useCallback, type FC} from 'react';
import {FieldSelector} from '../../chart-builders/FieldSelector';
import {ColumnSelector} from '../../chart-builders/ColumnSelector';
import {NUMERIC_COLUMN_TYPES} from '../../chart-builders/constants';
import {useChartSettingsContext} from '../../dashboard/chart-settings/ChartSettingsContext';
```

---

### Task 3: Refactor BoxPlotSettings.tsx

**Files:**

- Modify: `packages/mosaic/src/chart-types/box-plot/BoxPlotSettings.tsx`

- [ ] **Step 1: Add context import**

Add to imports:

```typescript
import {useChartSettingsContext} from '../../dashboard/chart-settings/ChartSettingsContext';
```

- [ ] **Step 2: Remove old imports and interface**

Remove:

```typescript
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {BoxPlotChartSettings} from './schema';

export interface BoxPlotSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: BoxPlotChartSettings;
  onChange: (values: BoxPlotChartSettings) => void;
}
```

- [ ] **Step 3: Refactor component to use context**

Replace component with:

```typescript
export const BoxPlotSettingsComponent: FC = () => {
  const {columns, onChange, config} = useChartSettingsContext('box-plot');

  const updateField = useCallback(
    (key: keyof BoxPlotChartSettings, value: any) => {
      onChange({
        ...config,
        settings: {
          ...config.settings,
          [key]: value,
        },
      });
    },
    [config, onChange],
  );

  return (
    <div className="space-y-4">
      <FieldSelector label="X Field (categorical)" required>
        <ColumnSelector
          columns={columns}
          value={config.settings.x}
          onChange={(x) => updateField('x', x)}
        />
      </FieldSelector>

      <FieldSelector label="Y Field (numeric)" required>
        <ColumnSelector
          columns={columns}
          types={NUMERIC_COLUMN_TYPES}
          value={config.settings.y}
          onChange={(y) => updateField('y', y)}
        />
      </FieldSelector>
    </div>
  );
};
```

---

### Task 4: Refactor CountPlotSettings.tsx

**Files:**

- Modify: `packages/mosaic/src/chart-types/count-plot/CountPlotSettings.tsx`

- [ ] **Step 1: Add context import**

Add to imports:

```typescript
import {useChartSettingsContext} from '../../dashboard/chart-settings/ChartSettingsContext';
```

- [ ] **Step 2: Remove old imports and interface**

Remove:

```typescript
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {CountPlotChartSettings} from './schema';

export interface CountPlotSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: CountPlotChartSettings;
  onChange: (values: CountPlotChartSettings) => void;
}
```

- [ ] **Step 3: Refactor component to use context**

Replace component with:

```typescript
export const CountPlotSettingsComponent: FC = () => {
  const {columns, onChange, config} = useChartSettingsContext('count-plot');

  const handleOnChange = useCallback(
    (field: string) => {
      onChange({
        ...config,
        settings: {
          ...config.settings,
          field,
        },
      });
    },
    [onChange, config],
  );

  return (
    <div className="space-y-4">
      <FieldSelector label="Field" required>
        <ColumnSelector
          columns={columns}
          types={QUANTITATIVE_COLUMN_TYPES}
          value={config.settings.field}
          onChange={handleOnChange}
        />
      </FieldSelector>
    </div>
  );
};
```

---

### Task 5: Refactor EcdfSettings.tsx

**Files:**

- Modify: `packages/mosaic/src/chart-types/ecdf/EcdfSettings.tsx`

- [ ] **Step 1: Add context import**

Add to imports:

```typescript
import {useChartSettingsContext} from '../../dashboard/chart-settings/ChartSettingsContext';
```

- [ ] **Step 2: Remove old imports and interface**

Remove:

```typescript
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {EcdfChartSettings} from './schema';

export interface EcdfSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: EcdfChartSettings;
  onChange: (values: EcdfChartSettings) => void;
}
```

- [ ] **Step 3: Refactor component to use context**

Replace component with:

```typescript
export const EcdfSettingsComponent: FC = () => {
  const {columns, onChange, config} = useChartSettingsContext('ecdf');

  const handleOnChange = useCallback(
    (field: string) => {
      onChange({
        ...config,
        settings: {
          ...config.settings,
          field,
        },
      });
    },
    [onChange, config],
  );

  return (
    <div className="space-y-4">
      <FieldSelector label="Field" required>
        <ColumnSelector
          columns={columns}
          types={QUANTITATIVE_COLUMN_TYPES}
          value={config.settings.field}
          onChange={handleOnChange}
        />
      </FieldSelector>
    </div>
  );
};
```

---

### Task 6: Refactor HeatmapSettings.tsx

**Files:**

- Modify: `packages/mosaic/src/chart-types/heatmap/HeatmapSettings.tsx`

- [ ] **Step 1: Add context import**

Add to imports:

```typescript
import {useChartSettingsContext} from '../../dashboard/chart-settings/ChartSettingsContext';
```

- [ ] **Step 2: Remove old imports and interface**

Remove:

```typescript
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {HeatmapChartSettings} from './schema';

export interface HeatmapSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: HeatmapChartSettings;
  onChange: (values: HeatmapChartSettings) => void;
}
```

- [ ] **Step 3: Refactor component to use context**

Replace component with:

```typescript
export const HeatmapSettingsComponent: FC = () => {
  const {columns, onChange, config} = useChartSettingsContext('heatmap');

  const updateField = useCallback(
    (key: keyof HeatmapChartSettings, value: any) => {
      onChange({
        ...config,
        settings: {
          ...config.settings,
          [key]: value,
        },
      });
    },
    [config, onChange],
  );

  return (
    <div className="space-y-4">
      <FieldSelector label="X Field" required>
        <ColumnSelector
          columns={columns}
          types={NUMERIC_COLUMN_TYPES}
          value={config.settings.x}
          onChange={(x) => updateField('x', x)}
        />
      </FieldSelector>

      <FieldSelector label="Y Field" required>
        <ColumnSelector
          columns={columns}
          types={NUMERIC_COLUMN_TYPES}
          value={config.settings.y}
          onChange={(y) => updateField('y', y)}
        />
      </FieldSelector>
    </div>
  );
};
```

---

### Task 7: Refactor LineChartSettings.tsx

**Files:**

- Modify: `packages/mosaic/src/chart-types/line-chart/LineChartSettings.tsx`

- [ ] **Step 1: Add context import**

Add to imports:

```typescript
import {useChartSettingsContext} from '../../dashboard/chart-settings/ChartSettingsContext';
```

- [ ] **Step 2: Remove old imports and interface**

Remove:

```typescript
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {LineChartSettings} from './schema';

export interface LineChartSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: LineChartSettings;
  onChange: (values: LineChartSettings) => void;
}
```

- [ ] **Step 3: Refactor component to use context**

Replace component with:

```typescript
export const LineChartSettingsComponent: FC = () => {
  const {columns, onChange, config} = useChartSettingsContext('line-chart');

  const updateField = useCallback(
    (key: keyof LineChartSettings, value: any) => {
      onChange({
        ...config,
        settings: {
          ...config.settings,
          [key]: value,
        },
      });
    },
    [config, onChange],
  );

  return (
    <div className="space-y-4">
      {/* X Axis */}
      <FieldSelector label="X Axis" required>
        <ColumnSelector
          columns={columns}
          types={QUANTITATIVE_COLUMN_TYPES}
          value={config.settings.x}
          onChange={(x) => updateField('x', x)}
        />
        {config.settings.x && (
          <TemporalGranularitySelector
            value={config.settings.xInterval}
            onChange={(xInterval) => updateField('xInterval', xInterval)}
            xFieldType={
              columns.find((c) => c.name === config.settings.x)?.type
            }
          />
        )}
      </FieldSelector>

      {/* Y Axes */}
      <MultiFieldSelector
        label="Y Axes"
        required
        columns={columns}
        types={NUMERIC_COLUMN_TYPES}
        value={config.settings.yFields || []}
        onChange={(yFields) => updateField('yFields', yFields)}
        showAggregation={Boolean(config.settings.xInterval)}
      />
    </div>
  );
};
```

---

### Task 8: Refactor CustomSpecSettings.tsx

**Files:**

- Modify: `packages/mosaic/src/chart-types/custom-spec/CustomSpecSettings.tsx`

- [ ] **Step 1: Remove old imports and interface**

Remove:

```typescript
import type {ChartBuilderColumn} from '../../chart-builders/types';
import type {CustomSpecChartSettings} from './schema';

export interface CustomSpecSettingsComponentProps {
  columns: ChartBuilderColumn[];
  values: CustomSpecChartSettings;
  onChange: (values: CustomSpecChartSettings) => void;
}
```

- [ ] **Step 2: Simplify component signature**

Replace component with:

```typescript
export const CustomSpecSettingsComponent: FC = () => {
  return (
    <div className="text-muted-foreground py-2 text-sm">
      This chart type has no configurable fields. A starter spec will be created
      that you can edit manually.
    </div>
  );
};
```

Note: This component doesn't need context since it has no interactive fields.

---

### Task 9: Update ChartSettings.tsx

**Files:**

- Modify: `packages/mosaic/src/dashboard/chart-settings/ChartSettings.tsx:101-148`

- [ ] **Step 1: Read current ChartSettingsFields implementation**

Verify lines 101-148 contain the ChartSettingsFields component.

- [ ] **Step 2: Remove unused variables and simplify render**

Replace the ChartSettingsFields component (lines 101-148) with:

```typescript
const ChartSettingsFields: FC = () => {
  const {config, columns} = useChartSettingsContext();
  const chartTypeDef = getChartTypeDefinition(config.chartType);

  if (!chartTypeDef) {
    console.error(`[ChartSettings] Unknown chart type: ${config.chartType}`);
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Unknown chart type: {config.chartType}
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        No columns available
      </div>
    );
  }

  const SettingsComponent = chartTypeDef.settingsComponent;
  return <SettingsComponent />;
};
```

- [ ] **Step 3: Remove unused imports**

Remove from imports (if no longer used elsewhere in file):

```typescript
import {useCallback, useMemo} from 'react';
```

Keep `type FC, type PropsWithChildren` from react.

---

### Task 10: Verify and test

**Files:**

- All modified files

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Manual testing - Start dev server**

Run: `pnpm dev minimal-example` (or another example that uses chart builder)
Expected: Dev server starts successfully

- [ ] **Step 4: Manual testing - Test each chart type**

In the browser:

1. Open the chart builder UI
2. Select each chart type one by one
3. Verify the settings fields appear correctly
4. Change field selections and verify they update
5. Verify no console errors

Test all chart types:

- histogram
- count-plot
- ecdf
- line-chart
- bubble-chart
- heatmap
- box-plot
- custom-spec

Expected: All chart types render correctly and field changes work.

---

## Self-Review Checklist

**Spec coverage:**

- ✅ BubbleChartSettings refactored
- ✅ BoxPlotSettings refactored
- ✅ CountPlotSettings refactored
- ✅ EcdfSettings refactored
- ✅ HeatmapSettings refactored
- ✅ LineChartSettings refactored
- ✅ CustomSpecSettings refactored
- ✅ base-types.ts updated
- ✅ ChartSettings.tsx simplified

**Placeholder scan:**

- No TBD, TODO, or "implement later"
- All code blocks are complete
- All file paths are exact
- All commands have expected output

**Type consistency:**

- All components use `useChartSettingsContext(chartType)` where chartType matches the chart type string
- All onChange calls pass the full config object
- All access config.settings.field consistently
- updateField helper is consistent across similar components
