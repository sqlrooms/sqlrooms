# TipTap Block Selection Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate stateful blocks (dashboards, charts, data tables) from custom SelectablePanelWrapper selection to TipTap's built-in node selection, while preserving panel-level custom selection inside dashboards.

**Architecture:** Two-tier selection system - TipTap owns block-level selection (dashboard/chart/data table blocks in the document), custom code owns panel-level selection (individual panels inside dashboards). BlockSettingsPanel reads from both sources with panel selection taking priority.

**Tech Stack:** TipTap v3.25.0, React, Zustand, TypeScript

## Global Constraints

- Follow existing TipTap patterns in the codebase
- Preserve backwards compatibility - no data migration required
- Maintain DRY principle - avoid code duplication
- Apply YAGNI - only implement what's needed
- Test-driven development - tests before implementation
- Frequent commits after each working change

---

### Task 1: Enable TipTap Selection for Stateful Block Nodes

**Files:**

- Modify: `packages/documents/src/BlockDocumentEditor/extensions/BlockDocumentStatefulBlockNode.tsx:10`
- Test: Manual verification (no existing tests for node config)

**Interfaces:**

- Consumes: Nothing (standalone node definition change)
- Produces: `BlockDocumentStatefulBlockNode` with `selectable: true` property

- [ ] **Step 1: Change selectable property to true**

Open `packages/documents/src/BlockDocumentEditor/extensions/BlockDocumentStatefulBlockNode.tsx` and change line 10:

```typescript
// Before
selectable: false,

// After
selectable: true,
```

Keep all other properties unchanged (`atom: true`, `draggable: false`, `isolating: true`, `stopEvent: stopWidgetNodeViewEvent`).

- [ ] **Step 2: Verify the change compiles**

Run: `cd packages/documents && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit the change**

```bash
git add packages/documents/src/BlockDocumentEditor/extensions/BlockDocumentStatefulBlockNode.tsx
git commit -m "feat: enable TipTap selection for stateful blocks

Change selectable from false to true to allow TipTap's native node
selection for dashboard and data table blocks.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2: Enable TipTap Selection for Chart Nodes

**Files:**

- Modify: `packages/documents/src/BlockDocumentEditor/extensions/BlockDocumentChartNode.tsx:9`
- Test: Manual verification (no existing tests for node config)

**Interfaces:**

- Consumes: Nothing (standalone node definition change)
- Produces: `BlockDocumentChartNode` with `selectable: true` property

- [ ] **Step 1: Change selectable property to true**

Open `packages/documents/src/BlockDocumentEditor/extensions/BlockDocumentChartNode.tsx` and change line 9:

```typescript
// Before
selectable: false,

// After
selectable: true,
```

Keep all other properties unchanged (`atom: true`, `draggable: false`, `isolating: true`, `stopEvent: stopWidgetNodeViewEvent`).

- [ ] **Step 2: Verify the change compiles**

Run: `cd packages/documents && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit the change**

```bash
git add packages/documents/src/BlockDocumentEditor/extensions/BlockDocumentChartNode.tsx
git commit -m "feat: enable TipTap selection for chart blocks

Change selectable from false to true to allow TipTap's native node
selection for chart blocks.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3: Remove SelectablePanelWrapper from Stateful Block Node View

**Files:**

- Modify: `packages/documents/src/BlockDocumentEditor/node-views/BlockDocumentStatefulBlockNodeView.tsx:342-403`
- Test: Manual verification with running app

**Interfaces:**

- Consumes: `BlockDocumentStatefulBlockNodeViewProps` with `selected: boolean` prop
- Produces: Node view without SelectablePanelWrapper, using TipTap's `selected` prop for outline styling

- [ ] **Step 1: Apply outline styling directly to NodeViewWrapper**

In `BlockDocumentStatefulBlockNodeView.tsx`, the `NodeViewWrapper` at line 343 already has conditional ring styling based on `selected` prop. The current code is:

```tsx
<NodeViewWrapper
  className={cn(
    'not-prose bg-background group/stateful-block relative my-4 rounded-md border',
    selected && 'ring-ring ring-2',
  )}
  contentEditable={false}
  data-block-document-widget-node-view=""
  style={wrapperStyle}
>
```

Change it to use outline instead of ring for consistency with SelectablePanelWrapper:

```tsx
<NodeViewWrapper
  className={cn(
    'not-prose bg-background group/stateful-block relative my-4 rounded-md border',
    selected && 'outline-primary outline outline-2',
  )}
  contentEditable={false}
  data-block-document-widget-node-view=""
  style={wrapperStyle}
>
```

This is the only change needed since stateful blocks don't use SelectablePanelWrapper at the block level - they render directly.

- [ ] **Step 2: Verify the change compiles**

Run: `cd packages/documents && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit the change**

```bash
git add packages/documents/src/BlockDocumentEditor/node-views/BlockDocumentStatefulBlockNodeView.tsx
git commit -m "feat: use TipTap selected prop for stateful block outline

Replace ring styling with outline styling to match SelectablePanelWrapper
visual treatment. Stateful blocks now use TipTap's native selection.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4: Remove SelectablePanelWrapper from Chart Node View

**Files:**

- Modify: `packages/documents/src/BlockDocumentEditor/node-views/BlockDocumentChartNodeView.tsx:75-120`
- Test: Manual verification with running app

**Interfaces:**

- Consumes: `BlockDocumentChartNodeViewProps` with `selected: boolean` prop
- Produces: Chart node view without block-level SelectablePanelWrapper, using TipTap's `selected` prop for outline styling

- [ ] **Step 1: Remove SelectablePanelWrapper import**

At line 18, remove the import:

```typescript
// Remove this line
import {SelectablePanelWrapper} from '../../block-selection/SelectablePanelWrapper';
```

- [ ] **Step 2: Update NodeViewWrapper className to use outline when selected**

Change the NodeViewWrapper starting at line 76:

```tsx
// Before
<NodeViewWrapper
  className={cn(
    'not-prose bg-background my-4 rounded-md border',
    selected && 'ring-ring ring-2',
  )}
  contentEditable={false}
  data-block-document-widget-node-view=""
>

// After
<NodeViewWrapper
  className={cn(
    'not-prose bg-background my-4 rounded-md border',
    selected && 'outline-primary outline outline-2',
  )}
  contentEditable={false}
  data-block-document-widget-node-view=""
>
```

- [ ] **Step 3: Remove SelectablePanelWrapper wrapper from JSX**

Replace lines 84-118 (the SelectablePanelWrapper and its content):

```tsx
// Before
<SelectablePanelWrapper
  dashboardId={documentId}
  panelId={blockId}
  panelType="chart-block"
  blockType="standalone-block"
>
  {Renderer ? (
    <ChartRendererBoundary
      Renderer={Renderer}
      documentId={documentId}
      blockId={blockId}
      tableName={tableName}
      config={config}
      selectionGroupId={selectionGroupId}
      caption={caption}
      readOnly={readOnly}
      onTableNameChange={handleTableNameChange}
      onConfigChange={handleConfigChange}
      onCaptionChange={handleCaptionChange}
    />
  ) : (
    <div className="p-4">
      <div className="text-sm font-medium">Chart block</div>
      <div className="text-muted-foreground mt-1 text-sm">
        No block document chart renderer is registered.
      </div>
      <div className="text-muted-foreground mt-3 grid gap-1 text-xs">
        <span>Table: {tableName || 'Unconfigured'}</span>
        {selectionGroupId ? (
          <span>Selection group: {selectionGroupId}</span>
        ) : null}
      </div>
    </div>
  )}
</SelectablePanelWrapper>;

// After (remove SelectablePanelWrapper, keep children)
{
  Renderer ? (
    <ChartRendererBoundary
      Renderer={Renderer}
      documentId={documentId}
      blockId={blockId}
      tableName={tableName}
      config={config}
      selectionGroupId={selectionGroupId}
      caption={caption}
      readOnly={readOnly}
      onTableNameChange={handleTableNameChange}
      onConfigChange={handleConfigChange}
      onCaptionChange={handleCaptionChange}
    />
  ) : (
    <div className="p-4">
      <div className="text-sm font-medium">Chart block</div>
      <div className="text-muted-foreground mt-1 text-sm">
        No block document chart renderer is registered.
      </div>
      <div className="text-muted-foreground mt-3 grid gap-1 text-xs">
        <span>Table: {tableName || 'Unconfigured'}</span>
        {selectionGroupId ? (
          <span>Selection group: {selectionGroupId}</span>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the change compiles**

Run: `cd packages/documents && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit the change**

```bash
git add packages/documents/src/BlockDocumentEditor/node-views/BlockDocumentChartNodeView.tsx
git commit -m "feat: remove SelectablePanelWrapper from chart blocks

Chart blocks now use TipTap's native selection instead of custom
wrapper. Removed SelectablePanelWrapper at block level and applied
outline styling directly to NodeViewWrapper.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 5: Create useSelectedBlockOrPanel Hook

**Files:**

- Create: `packages/documents/src/block-selection/useSelectedBlockOrPanel.ts`
- Test: `packages/documents/src/block-selection/useSelectedBlockOrPanel.test.ts` (create)

**Interfaces:**

- Consumes:
  - `Editor` from `@tiptap/react`
  - `useBlockSelection` hook from `./useBlockSelection`
  - `SelectedBlock` type from `./types`
- Produces:
  - `useSelectedBlockOrPanel(editor: Editor | null): SelectedItem | null`
  - `type SelectedItem = {type: 'block'; blockType: string; blockId: string; attrs: Record<string, any>} | {type: 'panel'; selectedBlock: SelectedBlock} | null`

- [ ] **Step 1: Write failing test for panel selection priority**

Create `packages/documents/src/block-selection/useSelectedBlockOrPanel.test.ts`:

```typescript
import {describe, it, expect, vi} from 'vitest';
import {renderHook} from '@testing-library/react';
import {useSelectedBlockOrPanel} from './useSelectedBlockOrPanel';
import type {Editor} from '@tiptap/react';
import {NodeSelection, TextSelection} from '@tiptap/pm/state';

// Mock useBlockSelection
vi.mock('./useBlockSelection', () => ({
  useBlockSelection: vi.fn(),
}));

import {useBlockSelection} from './useBlockSelection';

describe('useSelectedBlockOrPanel', () => {
  it('returns panel selection when panel is selected', () => {
    const mockPanelSelection = {
      type: 'dashboard-panel' as const,
      id: 'panel-1',
      dashboardId: 'dash-1',
      panelType: 'vgplot',
    };

    vi.mocked(useBlockSelection).mockReturnValue(mockPanelSelection);

    const mockEditor = null; // Editor not needed when panel selected

    const {result} = renderHook(() => useSelectedBlockOrPanel(mockEditor));

    expect(result.current).toEqual({
      type: 'panel',
      selectedBlock: mockPanelSelection,
    });
  });

  it('returns null when no editor', () => {
    vi.mocked(useBlockSelection).mockReturnValue(null);

    const {result} = renderHook(() => useSelectedBlockOrPanel(null));

    expect(result.current).toBeNull();
  });

  it('returns null when no panel and editor has text selection', () => {
    vi.mocked(useBlockSelection).mockReturnValue(null);

    const mockEditor = {
      state: {
        selection: {} as TextSelection, // Not a NodeSelection
      },
    } as Editor;

    const {result} = renderHook(() => useSelectedBlockOrPanel(mockEditor));

    expect(result.current).toBeNull();
  });

  it('returns block selection when node is selected', () => {
    vi.mocked(useBlockSelection).mockReturnValue(null);

    const mockNode = {
      type: {name: 'blockDocumentStatefulBlock'},
      attrs: {
        blockType: 'dashboard',
        id: 'block-123',
        blockInstanceId: 'instance-456',
      },
    };

    const mockEditor = {
      state: {
        selection: {
          node: mockNode,
        } as unknown as NodeSelection,
      },
    } as Editor;

    const {result} = renderHook(() => useSelectedBlockOrPanel(mockEditor));

    expect(result.current).toEqual({
      type: 'block',
      blockType: 'dashboard',
      blockId: 'block-123',
      attrs: mockNode.attrs,
    });
  });

  it('returns null when selected node has no blockType', () => {
    vi.mocked(useBlockSelection).mockReturnValue(null);

    const mockNode = {
      type: {name: 'paragraph'},
      attrs: {id: 'block-123'},
    };

    const mockEditor = {
      state: {
        selection: {
          node: mockNode,
        } as unknown as NodeSelection,
      },
    } as Editor;

    const {result} = renderHook(() => useSelectedBlockOrPanel(mockEditor));

    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/documents && pnpm test useSelectedBlockOrPanel`
Expected: FAIL with "Cannot find module './useSelectedBlockOrPanel'"

- [ ] **Step 3: Write minimal implementation**

Create `packages/documents/src/block-selection/useSelectedBlockOrPanel.ts`:

```typescript
import {useMemo} from 'react';
import type {Editor} from '@tiptap/react';
import {NodeSelection} from '@tiptap/pm/state';
import {useBlockSelection} from './useBlockSelection';
import type {SelectedBlock} from './types';

export type SelectedItem =
  | {
      type: 'block';
      blockType: string;
      blockId: string;
      attrs: Record<string, any>;
    }
  | {type: 'panel'; selectedBlock: SelectedBlock}
  | null;

/**
 * Hook that returns the currently selected block or panel.
 *
 * Priority order:
 * 1. Panel selection from blockSelection store (custom selection)
 * 2. Block selection from TipTap editor state (node selection)
 * 3. null if neither is selected
 *
 * @param editor - TipTap editor instance
 * @returns Selected block/panel info or null
 */
export function useSelectedBlockOrPanel(editor: Editor | null): SelectedItem {
  // Check panel selection first (higher priority)
  const panelSelection = useBlockSelection(
    (state) => state.blockSelection.config.selectedBlock,
  );

  return useMemo(() => {
    // Priority 1: Panel selection
    if (panelSelection) {
      return {
        type: 'panel',
        selectedBlock: panelSelection,
      };
    }

    // Priority 2: Block selection from TipTap
    if (!editor) {
      return null;
    }

    const {selection} = editor.state;

    // Check if it's a NodeSelection (not TextSelection or AllSelection)
    if (!(selection instanceof NodeSelection)) {
      return null;
    }

    const {node} = selection;

    // Extract blockType from node attributes
    const blockType = node.attrs.blockType;
    const blockId = node.attrs.id;

    if (!blockType || !blockId) {
      return null;
    }

    return {
      type: 'block',
      blockType,
      blockId,
      attrs: node.attrs,
    };
  }, [panelSelection, editor]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/documents && pnpm test useSelectedBlockOrPanel`
Expected: PASS - all 5 tests pass

- [ ] **Step 5: Export the hook from index**

Add export to `packages/documents/src/block-selection/index.ts`:

```typescript
export {useSelectedBlockOrPanel} from './useSelectedBlockOrPanel';
export type {SelectedItem} from './useSelectedBlockOrPanel';
```

- [ ] **Step 6: Verify the package builds**

Run: `cd packages/documents && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 7: Commit**

```bash
git add packages/documents/src/block-selection/useSelectedBlockOrPanel.ts packages/documents/src/block-selection/useSelectedBlockOrPanel.test.ts packages/documents/src/block-selection/index.ts
git commit -m "feat: add useSelectedBlockOrPanel hook

New hook that returns selected block or panel with priority:
1. Panel selection from custom store (dashboard panels)
2. Block selection from TipTap editor (stateful/chart blocks)

Includes comprehensive test coverage for all selection scenarios.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6: Update BlockSettingsPanel to Use Dual Selection

**Files:**

- Modify: `packages/documents/src/block-selection/BlockSettingsPanel.tsx:1-100`
- Test: Manual verification with running app

**Interfaces:**

- Consumes:
  - `useSelectedBlockOrPanel` hook from `./useSelectedBlockOrPanel`
  - `useBlockDocumentEditorContext` from `../BlockDocumentEditor/BlockDocumentEditorContext`
- Produces: BlockSettingsPanel that reads from both TipTap and custom selection

- [ ] **Step 1: Import required dependencies**

At the top of `BlockSettingsPanel.tsx`, add imports and update existing ones:

```typescript
import {cn} from '@sqlrooms/ui';
import {createElement, FC, useMemo} from 'react';
import {useBlockSelection} from './useBlockSelection';
import {useSelectedBlockOrPanel} from './useSelectedBlockOrPanel';
import {useBlockDocumentEditorContext} from '../BlockDocumentEditor/BlockDocumentEditorContext';
import {SettingsErrorBoundary} from './SettingsErrorBoundary';
```

- [ ] **Step 2: Replace component implementation**

Replace the entire component implementation (lines 33-100) with:

```typescript
export const BlockSettingsPanel: FC<BlockSettingsPanelProps> = ({
  className,
}) => {
  const {editor} = useBlockDocumentEditorContext();
  const selectedItem = useSelectedBlockOrPanel(editor);
  const getSettings = useBlockSelection(
    (state) => state.blockSelection.getSettings,
  );

  // Determine settings component based on selection type
  const SettingsComponent = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    if (selectedItem.type === 'panel') {
      const {selectedBlock} = selectedItem;

      // Dashboard block has its own registry key
      if (selectedBlock.type === 'dashboard-block') {
        return getSettings('dashboard-block');
      }

      // Panel types need panelType to construct the key
      if (!selectedBlock.panelType) {
        return null;
      }

      const blockType =
        selectedBlock.type === 'dashboard-panel'
          ? `dashboard-panel:${selectedBlock.panelType}`
          : `standalone-block:${selectedBlock.panelType}`;

      return getSettings(blockType);
    }

    // Block selection from TipTap
    if (selectedItem.type === 'block') {
      // Construct registry key for stateful blocks
      const registryKey = `standalone-block:${selectedItem.blockType}`;
      return getSettings(registryKey);
    }

    return null;
  }, [selectedItem, getSettings]);

  // Determine props to pass to settings component
  const settingsProps = useMemo(() => {
    if (!selectedItem) return null;

    if (selectedItem.type === 'panel') {
      return {
        blockId: selectedItem.selectedBlock.id,
        dashboardId: selectedItem.selectedBlock.dashboardId,
      };
    }

    if (selectedItem.type === 'block') {
      return {
        blockId: selectedItem.blockId,
        dashboardId: selectedItem.attrs.blockInstanceId,
      };
    }

    return null;
  }, [selectedItem]);

  if (!selectedItem || !settingsProps) {
    return (
      <div
        className={cn('flex h-full items-center justify-center p-4', className)}
      >
        <p className="text-muted-foreground text-sm">
          Select a block to edit settings
        </p>
      </div>
    );
  }

  if (!SettingsComponent) {
    return (
      <div
        className={cn('flex h-full items-center justify-center p-4', className)}
      >
        <p className="text-muted-foreground text-sm">
          No settings available for this block
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <SettingsErrorBoundary>
        {createElement(SettingsComponent, settingsProps)}
      </SettingsErrorBoundary>
    </div>
  );
};
```

- [ ] **Step 3: Verify the change compiles**

Run: `cd packages/documents && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add packages/documents/src/block-selection/BlockSettingsPanel.tsx
git commit -m "feat: update BlockSettingsPanel for dual selection

BlockSettingsPanel now reads from both sources:
- Panel selection (custom store) - takes priority
- Block selection (TipTap editor state)

Constructs appropriate registry keys and props for each selection type.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 7: Update BlockSelectionSlice Documentation

**Files:**

- Modify: `packages/documents/src/block-selection/BlockSelectionSlice.ts:1-10`
- Test: Manual verification (documentation only)

**Interfaces:**

- Consumes: Nothing (documentation change only)
- Produces: Updated documentation explaining two-tier selection system

- [ ] **Step 1: Add migration comment to file**

At the top of `BlockSelectionSlice.ts`, after the imports, add a documentation comment:

```typescript
/**
 * Block Selection Slice
 *
 * TWO-TIER SELECTION SYSTEM:
 *
 * This slice manages panel-level selection (dashboard panels, standalone blocks
 * that need custom selection). As of the TipTap selection migration:
 *
 * - BLOCK-LEVEL selection: Handled by TipTap's native node selection
 *   (dashboard blocks, chart blocks, data table blocks in documents)
 *
 * - PANEL-LEVEL selection: Handled by this slice (custom selection)
 *   (individual panels inside dashboards, standalone selectable components)
 *
 * The BlockSettingsPanel reads from both sources with panel selection taking
 * priority (more specific than block selection).
 *
 * DO NOT use this slice for selecting blocks in TipTap documents - use
 * TipTap's editor.commands.setNodeSelection() instead.
 */
```

- [ ] **Step 2: Verify the change compiles**

Run: `cd packages/documents && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add packages/documents/src/block-selection/BlockSelectionSlice.ts
git commit -m "docs: document two-tier selection system

Add explanation of block-level (TipTap) vs panel-level (custom)
selection to BlockSelectionSlice for future developers.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 8: Manual End-to-End Testing

**Files:**

- Test: Running application (all changes integrated)

**Interfaces:**

- Consumes: All previous task outputs
- Produces: Verification that selection works correctly

- [ ] **Step 1: Build all packages**

Run: `pnpm build`
Expected: All packages build successfully

- [ ] **Step 2: Start the application**

Run: `pnpm dev sqlrooms-cli-ui-example` (or whichever app uses the block document editor)
Expected: Application starts without errors

- [ ] **Step 3: Test dashboard block selection**

Manual steps:

1. Create or open a document with a dashboard block
2. Click on the dashboard block
3. Verify: Block shows outline (TipTap selection)
4. Verify: Settings panel shows dashboard block settings
5. Verify: Keyboard arrow keys navigate between blocks
6. Verify: Delete key deletes the dashboard block

Expected: All behaviors work correctly

- [ ] **Step 4: Test panel selection inside dashboard**

Manual steps:

1. Click on a panel (chart/map) inside the dashboard
2. Verify: Panel shows outline (NOT the dashboard block)
3. Verify: Settings panel shows panel settings (NOT dashboard settings)
4. Verify: Panel selection takes priority over block selection

Expected: Panel selection works and takes priority

- [ ] **Step 5: Test chart block selection**

Manual steps:

1. Create or open a document with a chart block
2. Click on the chart block
3. Verify: Block shows outline (TipTap selection)
4. Verify: Settings panel shows chart block settings
5. Verify: Arrow keys navigate, delete key removes block

Expected: Chart blocks behave like dashboard blocks

- [ ] **Step 6: Test empty space in dashboard**

Manual steps:

1. Click on empty space inside a dashboard (not on a panel)
2. Verify: Dashboard block gets selected (not a panel)
3. Verify: Settings panel shows dashboard settings

Expected: Clicking empty space selects the dashboard block

- [ ] **Step 7: Test event propagation**

Manual steps:

1. Click on interactive elements inside charts (buttons, tooltips, controls)
2. Verify: These clicks don't trigger selection
3. Click on a panel, then click on a different panel
4. Verify: Selection switches correctly

Expected: No event propagation conflicts

- [ ] **Step 8: Document test results**

Create a test summary file (not committed):

```bash
# Test Results - TipTap Block Selection Migration
Date: $(date)

## Dashboard Block Selection
- [ ] Block outline on click
- [ ] Settings panel shows dashboard settings
- [ ] Keyboard navigation works
- [ ] Delete key removes block

## Panel Selection
- [ ] Panel outline on click
- [ ] Settings panel shows panel settings
- [ ] Panel selection takes priority

## Chart Block Selection
- [ ] Block outline on click
- [ ] Settings panel shows chart settings
- [ ] Keyboard operations work

## Edge Cases
- [ ] Empty space clicks select dashboard
- [ ] Interactive elements don't trigger selection
- [ ] Panel switching works correctly

## Issues Found
[List any issues discovered during testing]
```

- [ ] **Step 9: Fix any issues found**

If issues are found during testing:

1. Diagnose the root cause
2. Create a fix
3. Test the fix
4. Commit the fix with a descriptive message

---

### Task 9: Add Cleanup Logic for Panel Selection

**Files:**

- Modify: `packages/documents/src/block-selection/BlockSelectionSlice.ts` (add cleanup methods)
- Modify: `packages/documents/src/BlockDocumentEditor/BlockDocumentEditorRoot.tsx` (call cleanup on document change)
- Test: Manual verification

**Interfaces:**

- Consumes: `BlockSelectionSlice` with existing selection methods
- Produces: Cleanup methods that clear panel selection when blocks are deleted or documents change

- [ ] **Step 1: Add clearSelectionIfBlockDeleted method to BlockSelectionSlice**

In `BlockSelectionSlice.ts`, add a new method to the slice (after `clearSelection`):

```typescript
/**
 * Clear panel selection if the selected block is deleted.
 * Call this when a block is removed from the document.
 */
clearSelectionIfBlockDeleted: (blockId: string) => {
  const {selectedBlock} = get().blockSelection.config;
  if (!selectedBlock) return;

  // Clear if the deleted block matches the selection
  if (selectedBlock.id === blockId || selectedBlock.dashboardId === blockId) {
    get().blockSelection.clearSelection();
  }
},
```

- [ ] **Step 2: Add clearAllSelection method for document changes**

In `BlockSelectionSlice.ts`, add another method:

```typescript
/**
 * Clear all custom selection state.
 * Call this when switching documents or unmounting editor.
 */
clearAllSelection: () => {
  get().blockSelection.clearSelection();
},
```

- [ ] **Step 3: Export cleanup methods from slice**

Verify the methods are part of the slice's return object and exported properly.

- [ ] **Step 4: Add cleanup effect in BlockDocumentEditorRoot**

In `BlockDocumentEditorRoot.tsx`, import the cleanup method:

```typescript
import {useBlockSelection} from '../block-selection/useBlockSelection';
```

Then add a cleanup effect after the editor is created:

```typescript
// Add this effect after the useEditor hook
useEffect(() => {
  return () => {
    // Clear custom selection when document changes or editor unmounts
    blockSelection?.clearAllSelection();
  };
}, [documentId, blockSelection]);
```

Note: You'll need to get the blockSelection methods from the hook first:

```typescript
const clearAllSelection = useBlockSelection(
  (state) => state.blockSelection.clearAllSelection,
);
```

- [ ] **Step 5: Verify the changes compile**

Run: `cd packages/documents && pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 6: Test cleanup behavior**

Manual test:

1. Select a panel inside a dashboard
2. Switch to a different document
3. Verify: Panel selection is cleared
4. Verify: No stale selection in settings panel

Expected: Selection clears when documents change

- [ ] **Step 7: Commit**

```bash
git add packages/documents/src/block-selection/BlockSelectionSlice.ts packages/documents/src/BlockDocumentEditor/BlockDocumentEditorRoot.tsx
git commit -m "feat: add panel selection cleanup on document change

Clear panel selection when switching documents or unmounting editor
to prevent stale selection state.

Adds clearSelectionIfBlockDeleted and clearAllSelection methods to
BlockSelectionSlice for proper cleanup.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Self-Review Checklist

**Spec coverage:**

- ✅ Node definitions: Tasks 1-2
- ✅ Node views: Tasks 3-4
- ✅ BlockSettingsPanel: Tasks 5-6
- ✅ BlockSelectionSlice documentation: Task 7
- ✅ Edge cases (event propagation, cleanup): Tasks 8-9
- ✅ Manual testing: Task 8

**Placeholder scan:**

- ✅ No TBD, TODO, or "implement later"
- ✅ All code blocks are complete
- ✅ All commands have expected output
- ✅ All test cases are fully written

**Type consistency:**

- ✅ `SelectedItem` type defined in Task 5 and used in Task 6
- ✅ `useSelectedBlockOrPanel` signature matches across tasks
- ✅ `blockType` and `blockId` property names consistent
- ✅ Settings component props (`blockId`, `dashboardId`) consistent

**Architecture verification:**

- ✅ Two-tier selection: TipTap for blocks, custom for panels
- ✅ Priority order: panel selection > block selection
- ✅ No sync needed between systems (different scopes)
- ✅ Cleanup on document change
