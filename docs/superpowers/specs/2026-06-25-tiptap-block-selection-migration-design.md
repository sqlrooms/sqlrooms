---
name: tiptap-block-selection-migration
description: Migrate stateful blocks from custom selection to TipTap's built-in node selection while preserving panel-level custom selection
metadata:
  type: design
  date: 2026-06-25
---

# TipTap Block Selection Migration Design

## Context

SQLRooms uses TipTap for document editing with various block types (dashboards, charts, data tables, images). Currently, all stateful blocks have `selectable: false` and use a custom selection system via `SelectablePanelWrapper` and a Zustand `blockSelection` store. This causes issues:

- Dashboard blocks feel like they "skip" selection - clicks are intercepted by the custom wrapper which calls `stopPropagation()`, preventing TipTap's event system from firing
- Custom selection duplicates TipTap's capabilities (keyboard navigation, delete, copy/paste)
- Two parallel selection systems are confusing and harder to maintain

**Goal:** Migrate stateful blocks (dashboards, charts, data tables) to use TipTap's native node selection, while preserving custom selection for panels _inside_ dashboards.

## Architecture Overview

### Selection Ownership

**TipTap owns:**

- Block-level selection (dashboard block, chart block, data table block)
- Keyboard navigation between blocks
- Delete/copy/paste operations on blocks

**Custom code owns:**

- Panel-level selection (individual charts/maps inside a dashboard)
- Panel-specific settings and interactions

### Key Principle: Two-Tier Selection

This is a **two-tier selection system** with clear scope separation:

1. **Document tier** (TipTap): Blocks are nodes in the document tree
2. **Widget tier** (Custom): Panels are internal state within dashboard blocks

The systems don't need to sync because they operate at different levels of granularity.

## Selection State Flow

### Block Selection (TipTap)

1. User clicks on dashboard/chart block
2. TipTap's event system detects click on selectable node
3. Editor state updates with `NodeSelection` at that position
4. Node view receives `selected={true}` prop
5. `BlockSettingsPanel` reads `editor.state.selection` → shows block settings

### Panel Selection (Custom)

1. User clicks on panel inside dashboard
2. `SelectablePanelWrapper` onClick fires
3. Calls `e.stopPropagation()` to prevent event reaching TipTap (critical!)
4. Updates `blockSelection` store with panel metadata
5. `BlockSettingsPanel` reads blockSelection store → shows panel settings

### Settings Panel Priority

The `BlockSettingsPanel` checks both sources in order:

1. **First:** Is there a panel selected in blockSelection store? → Show panel settings
2. **Second:** Is there a block selected in `editor.state.selection`? → Show block settings
3. **Neither:** Show "Select a block to edit settings"

Panel selection takes priority because it's more specific.

### Clearing Selection

- **Panel selection:** Automatically cleared when selecting a different block, clicking outside dashboard, or switching documents
- **Block selection:** Cleared by TipTap when clicking in text, selecting different block, or pressing Escape

## Implementation Changes

### 1. Node Definitions

**Files:**

- `packages/documents/src/BlockDocumentEditor/extensions/BlockDocumentStatefulBlockNode.tsx`
- `packages/documents/src/BlockDocumentEditor/extensions/BlockDocumentChartNode.tsx`

**Changes:**

```typescript
// Before
selectable: false;

// After
selectable: true;
```

Keep existing settings:

- `atom: true` - blocks are atomic units
- `draggable: false` - disable drag for now
- `isolating: true` - selection can't cross block boundaries
- `stopEvent: stopWidgetNodeViewEvent` - prevents widget interactions from affecting editor

### 2. Node Views

**Files:**

- `packages/documents/src/BlockDocumentEditor/node-views/BlockDocumentStatefulBlockNodeView.tsx`
- `packages/documents/src/BlockDocumentEditor/node-views/BlockDocumentChartNodeView.tsx`

**Changes:**

1. Remove `SelectablePanelWrapper` import and usage at block level
2. Apply outline styling directly to `NodeViewWrapper` based on `props.selected`
3. Remove click handler (TipTap handles block selection automatically)

**Before:**

```tsx
<NodeViewWrapper contentEditable={false}>
  <SelectablePanelWrapper
    selected={...}
    onSelect={...}
  >
    {/* block content */}
  </SelectablePanelWrapper>
</NodeViewWrapper>
```

**After:**

```tsx
<NodeViewWrapper
  contentEditable={false}
  className={props.selected ? 'outline-primary outline outline-2' : ''}
>
  {/* block content directly */}
</NodeViewWrapper>
```

### 3. BlockSettingsPanel

**File:**

- `packages/documents/src/block-selection/BlockSettingsPanel.tsx`

**New hook:** Create `useSelectedBlockOrPanel(editor)` that returns:

```typescript
type SelectedItem =
  | {type: 'block'; blockType: string; attrs: Record<string, any>}
  | {type: 'panel'; panelType: string /* ...existing panel data */}
  | null;
```

**Logic:**

1. Check `blockSelection` store for panel selection (existing pattern)
2. If no panel selected, check `editor.state.selection`:
   - Verify it's a `NodeSelection` (not TextSelection or AllSelection)
   - Get selected node: `selection.node`
   - Extract blockType from node attributes
   - Return block selection info
3. Return null if neither

**Update BlockSettingsPanel:**

- Replace direct blockSelection store access with new hook
- Lookup settings component from registry using `blockType` from either source
- Show appropriate settings based on selection type

### 4. BlockSelectionSlice

**File:**

- `packages/documents/src/block-selection/BlockSelectionSlice.ts`

**Changes:**

- Scope down to panel-only selection
- Remove or deprecate block-level selection methods if they exist
- Add migration comment explaining two-tier system

**Note:** Most code should already be panel-focused since blocks were never truly selected before (clicks were captured but selection didn't work properly).

### 5. Dashboard and Chart Renderers

**Files:**

- `apps/sqlrooms-cli-ui/src/workspace/WorksheetDashboardBlockRenderer.tsx`
- Chart renderer files (if they use SelectablePanelWrapper at block level)

**Changes:**

- Remove `SelectablePanelWrapper` at block level (handled by node view)
- Keep `SelectablePanelWrapper` for panels inside dashboards
- Ensure panels still call `e.stopPropagation()` to prevent parent block selection

## Edge Cases and Solutions

### Event Propagation

**Challenge:** Panel clicks must not also select parent block

**Solution:**

- `SelectablePanelWrapper` (for panels) keeps `e.stopPropagation()`
- TipTap's `stopWidgetNodeViewEvent` prevents widget interactions from affecting editor
- Test thoroughly: clicking panel should select panel only, not block

### Empty Space in Dashboard

**Challenge:** Clicking empty areas inside dashboard should select the block

**Solution:**

- Remove pointer-events blocking on dashboard container if present
- TipTap will handle clicks on the node view naturally

### Nested Interactive Elements

**Challenge:** Chart tooltips, buttons, controls shouldn't trigger selection

**Solution:**

- `stopWidgetNodeViewEvent` already handles this via `data-block-document-widget-node-view` attribute
- Verify it works after removing SelectablePanelWrapper

### State Clearing

**When blocks are deleted:**

- Clear panel selection if it belonged to the deleted block
- Add cleanup logic in BlockSelectionSlice or editor event handlers

**When switching documents:**

- Clear all custom selection state
- TipTap handles its own state automatically

### Multiple Blocks Selected

**Challenge:** TipTap allows range selections spanning multiple blocks

**Solution:**

- BlockSettingsPanel should only show settings for single-node selections
- Check `selection instanceof NodeSelection` before extracting block info
- Show nothing (or "Select a single block") for multi-block selections

### Keyboard Operations

**TipTap provides:**

- Arrow keys to navigate between blocks
- Delete/Backspace to remove selected block
- Copy/paste for blocks

**Ensure:**

- Deleting dashboard properly cleans up its internal state
- Pasting blocks creates new IDs for duplicated content
- Panel state doesn't leak between copied blocks

### Backwards Compatibility

- Old documents with existing blocks work unchanged (no data migration)
- Behavior change only affects selection interaction
- Any code directly calling blockSelection methods for blocks needs update (likely minimal since blocks weren't selectable before)

## Critical Files Summary

### Must Change

- `packages/documents/src/BlockDocumentEditor/extensions/BlockDocumentStatefulBlockNode.tsx` - selectable: true
- `packages/documents/src/BlockDocumentEditor/extensions/BlockDocumentChartNode.tsx` - selectable: true
- `packages/documents/src/BlockDocumentEditor/node-views/BlockDocumentStatefulBlockNodeView.tsx` - remove SelectablePanelWrapper
- `packages/documents/src/BlockDocumentEditor/node-views/BlockDocumentChartNodeView.tsx` - remove SelectablePanelWrapper
- `packages/documents/src/block-selection/BlockSettingsPanel.tsx` - add dual-source hook
- `apps/sqlrooms-cli-ui/src/workspace/WorksheetDashboardBlockRenderer.tsx` - remove block-level wrapper

### May Need Updates

- `packages/documents/src/block-selection/BlockSelectionSlice.ts` - scope to panels only
- `packages/documents/src/block-selection/SelectablePanelWrapper.tsx` - verify stopPropagation still works
- Any chart renderers using SelectablePanelWrapper at block level

### Keep Unchanged

- `packages/documents/src/BlockDocumentEditor/extensions/nodeViewEvents.ts` - stopWidgetNodeViewEvent is correct
- `packages/documents/src/block-selection/useBlockSelection.ts` - panel selection hook remains
- Panel-level SelectablePanelWrapper usage inside dashboards

## Verification

### Manual Testing

1. **Block Selection**
   - Click dashboard block → ring outline appears, settings panel shows block settings
   - Click chart block → ring outline appears, settings panel shows block settings
   - Click between blocks → selection changes correctly
   - Arrow keys navigate between blocks

2. **Panel Selection**
   - Click panel inside dashboard → panel outline appears, panel settings show
   - Panel selection takes priority in settings panel
   - Click different panel → selection switches
   - Click outside dashboard → panel selection clears

3. **Event Propagation**
   - Click panel → does NOT also select parent block (critical test)
   - Click empty space in dashboard → selects dashboard block only
   - Click chart controls/tooltips → doesn't trigger selection

4. **Keyboard Operations**
   - Delete key on selected dashboard → deletes block cleanly
   - Copy/paste block → creates duplicate with new IDs
   - Escape key → clears selection
   - Backspace from text → doesn't accidentally delete blocks

5. **Settings Panel**
   - Shows correct settings for selected block type
   - Shows correct settings for selected panel
   - Shows "Select a block..." when nothing selected
   - Switches correctly as selection changes

### Automated Testing

**Unit tests:**

- `useSelectedBlockOrPanel` hook returns correct data for block selection
- `useSelectedBlockOrPanel` hook returns correct data for panel selection
- Hook returns null when nothing selected

**Integration tests:**

- Render editor with stateful blocks
- Simulate block clicks → verify NodeSelection in editor state
- Simulate panel clicks → verify blockSelection store updates
- Verify BlockSettingsPanel renders correct component for each case

### Rollout

1. Implement changes in feature branch: `feat/tiptap-block-selection`
2. Manual testing with all block types (dashboard, chart, data table)
3. Test with existing documents to ensure backwards compatibility
4. Merge and monitor for selection-related issues

## Success Criteria

- Dashboard blocks are immediately selectable on click (no "skipping")
- Keyboard navigation works: arrow keys, delete, copy/paste
- Panel selection inside dashboards continues to work
- Settings panel shows correct settings for both blocks and panels
- No event propagation conflicts between the two selection systems
- All existing documents continue to work without migration
