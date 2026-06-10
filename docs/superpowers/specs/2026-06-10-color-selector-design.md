# Color Selector for MultiFieldSelector

**Date:** 2026-06-10  
**Status:** Approved

## Overview

Add a color selector dropdown to the MultiFieldSelector component, allowing users to choose colors for individual line chart fields. Colors will be displayed as circular indicators in a dropdown menu.

## Problem

Currently, line chart colors are automatically assigned based on field index using the `CHART_COLORS` palette. While the `YFieldConfig` schema already supports an optional `color` property, there is no UI for users to select colors. Users cannot customize which color is used for each line.

## Goals

- Allow users to explicitly select colors for line chart fields
- Display color options as circular indicators in a dropdown
- Extract color constants to a shared location for reusability
- Maintain existing behavior when no color is selected (index-based fallback)
- Follow existing component patterns (ColumnSelector, AggregationSelector)

## Non-Goals

- Custom color picker (hex input, color wheel) - only predefined palette colors
- Color selection for other chart types (scope limited to line charts via MultiFieldSelector)
- Color theme customization (use existing CHART_COLORS palette)

## Design

### 1. File Structure

**New files:**

- `packages/mosaic/src/constants/chart-colors.ts` - Shared color constants
- `packages/mosaic/src/components/ColorSelector.tsx` - Color selector component

**Modified files:**

- `packages/mosaic/src/charts/chart-types/line-chart/spec.ts` - Import from constants
- `packages/mosaic/src/components/MultiFieldSelector.tsx` - Add ColorSelector to grid

### 2. Color Constants

Extract `CHART_COLORS` from `line-chart/spec.ts` to a shared constants file:

```typescript
// packages/mosaic/src/constants/chart-colors.ts
export const CHART_COLORS = [
  '#ea7c5c', // chart-1: hsl(12, 76%, 61%)
  '#2a9d8f', // chart-2: hsl(173, 58%, 39%)
  '#264653', // chart-3: hsl(197, 37%, 24%)
  '#e9c46a', // chart-4: hsl(43, 74%, 66%)
  '#f4a261', // chart-5: hsl(27, 87%, 67%)
];
```

Update `line-chart/spec.ts` to import from constants:

```typescript
import {CHART_COLORS} from '../../../constants/chart-colors';
```

### 3. ColorSelector Component

**Component API:**

```typescript
interface ColorSelectorProps {
  value: string | undefined;
  onChange: (color: string) => void;
}
```

**Implementation details:**

- Uses `@sqlrooms/ui` Select component (consistent with other selectors)
- Trigger button displays current color as a filled circle (16px diameter)
- Dropdown shows all colors from `CHART_COLORS` as labeled options
- Each option shows a colored circle with the hex value
- Circles have subtle border for visibility
- When `value === undefined`, shows placeholder/default state

**Component structure:**

```typescript
<Select value={value} onValueChange={onChange}>
  <SelectTrigger>
    <ColorCircle color={value} />
  </SelectTrigger>
  <SelectContent>
    {CHART_COLORS.map(color => (
      <SelectItem value={color}>
        <ColorCircle color={color} />
        {color}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 4. MultiFieldSelector Integration

**Grid layout changes:**

Current (with aggregation):

```
gridTemplateColumns: 'minmax(120px, 1fr) 100px 32px'
// field selector | aggregation | delete button
```

New (with color selector):

```
gridTemplateColumns: 'minmax(120px, 1fr) 100px 60px 32px'
// field selector | aggregation | color | delete button
```

**Visibility:**

- ColorSelector shows when `showAggregation={true}`
- Coupled to aggregation because color selection is primarily for line charts
- Could add explicit `showColorSelector` prop later if needed

**Data flow:**

```typescript
<ColorSelector
  value={fieldConfig.color}
  onChange={(color) => handleUpdate(index, {color})}
/>
```

### 5. Color Assignment Behavior

**When color is undefined:**

- Spec generation uses index-based fallback: `CHART_COLORS[index % CHART_COLORS.length]`
- Preserves existing automatic color assignment
- No breaking changes to current behavior

**When color is selected:**

- User's chosen color is stored in `YFieldConfig.color`
- Spec generation uses explicit color value
- Color persists across component re-renders and dashboard saves

### 6. Visual Design

**ColorCircle component (inline utility):**

- 16px × 16px circular div
- `background-color` set to the hex value
- `border: 1px solid rgba(0, 0, 0, 0.1)` for light backgrounds
- `border-radius: 50%` for circle shape

**Dropdown styling:**

- Follows existing Select component patterns
- Color circle aligned left, hex value to the right
- Selected color highlighted in dropdown

## Error Handling

**No error states required:**

- Color selection is always optional
- All colors are valid CSS hex strings
- Component gracefully handles `undefined` value
- Empty CHART_COLORS array is impossible in practice

## Testing Strategy

Manual testing only - verify color selection works in the running app.

## Implementation Notes

- Follow existing patterns from ColumnSelector and AggregationSelector
- Use `@sqlrooms/ui` components for consistency
- Keep ColorSelector simple and focused (YAGNI)
- No custom color picker in initial implementation
- Color constants are reusable for future chart types

## Future Enhancements (Out of Scope)

- Custom color picker with hex input
- Color selection for other chart types (scatter, histogram)
- Per-dataset color theme overrides
- Color accessibility validation
- Color palette management UI
