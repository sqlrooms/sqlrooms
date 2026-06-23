# Selected Block System Design

**Date:** 2026-06-23  
**Status:** Draft

## Context

SQLRooms needs a unified way to select blocks/panels and display their settings in a sidebar. Currently, some panels (like maps) have inline settings panels, but there's no universal system for:

1. Tracking which block/panel is currently selected
2. Showing settings for the selected block in an external component
3. Visual indication of selection
4. Consistent selection behavior (click, focus, deselection)

This system will enable placing a settings panel anywhere in the UI (right sidebar, modal, separate window) while maintaining a single source of truth for what's selected.

## Goals

- Universal selection system that works for dashboard panels and standalone blocks
- Centralized state management via Zustand slice
- Registry pattern for settings components
- Minimal props for the settings panel component (className, onClose)
- Visual feedback (border/outline) for selected blocks
- Selection via click and focus
- Deselection via click outside or click on already-selected block

## Non-Goals

- Complex layout management for the settings panel (parent handles positioning)
- Settings persistence (settings components handle their own state)
- Multi-selection
- Keyboard navigation between blocks (can be added later)

## Architecture

### 1. Block Selection Slice

New package: `packages/block-selection/`

**State:**

```typescript
type SelectedBlock = {
  type: 'dashboard-panel' | 'standalone-block';
  id: string;
  dashboardId?: string; // Required when type is 'dashboard-panel'
};

type BlockSelectionSliceConfig = {
  selectedBlock?: SelectedBlock;
};

type BlockSelectionSliceState = {
  blockSelection: SliceFunctions & {
    config: BlockSelectionSliceConfig;
    runtime: {
      settingsRegistry: Record<string, BlockSettingsComponent>;
    };
    selectBlock: (block: SelectedBlock) => void;
    clearSelection: () => void;
    getSelectedBlock: () => SelectedBlock | undefined;
    isBlockSelected: (
      type: string,
      id: string,
      dashboardId?: string,
    ) => boolean;
    registerSettings: (
      blockType: string,
      component: BlockSettingsComponent,
    ) => void;
    unregisterSettings: (blockType: string) => void;
    getSettings: (blockType: string) => BlockSettingsComponent | undefined;
  };
};
```

**Behavior:**

- `selectBlock()`: If the same block is already selected, clears selection (toggle behavior)
- `clearSelection()`: Removes current selection
- `isBlockSelected()`: Returns true if the specified block matches current selection
- Settings registry is runtime-only state (not serialized)

### 2. Settings Registry

**Interface:**

```typescript
type BlockSettingsComponentProps = {
  blockId: string;
  dashboardId?: string;
  onClose?: () => void;
};

type BlockSettingsComponent = ComponentType<BlockSettingsComponentProps>;
```

**Built-in Registrations:**

When MosaicDashboard initializes, it registers:

- `'dashboard-panel:vgplot'` → `ChartSettingsComponent`
- `'dashboard-panel:deck-map'` → `MapSettingsComponent`
- `'dashboard-panel:data-table-explorer'` → no settings (future)

**Block Type Format:**

- Dashboard panels: `'dashboard-panel:${panelType}'`
- Standalone blocks: `'standalone-block:${blockType}'`

### 3. Selectable Wrapper Components

**SelectablePanelWrapper:**

```typescript
type SelectablePanelWrapperProps = {
  dashboardId: string;
  panelId: string;
  panelType: string;
  children: ReactNode;
};
```

**Features:**

- Adds `onClick` handler: calls `selectBlock({type: 'dashboard-panel', id: panelId, dashboardId})`
- Adds `onFocus` handler via `tabIndex={0}` for keyboard accessibility
- Applies visual styles when `isBlockSelected()` returns true
- Sets up click-outside listener to call `clearSelection()`

**Visual Indication:**

```typescript
const isSelected = useBlockSelection(state =>
  state.isBlockSelected('dashboard-panel', panelId, dashboardId)
);

className={cn(
  "relative transition-all",
  isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
)}
```

**Integration Point:**
Modify `MosaicDashboardPanels` to wrap each rendered panel with `SelectablePanelWrapper`.

### 4. BlockSettingsPanel Component

**Interface:**

```typescript
type BlockSettingsPanelProps = {
  className?: string;
  onClose?: () => void;
};
```

**Implementation:**

```typescript
export function BlockSettingsPanel({className, onClose}: BlockSettingsPanelProps) {
  const selectedBlock = useBlockSelection(state => state.blockSelection.selectedBlock);
  const getSettings = useBlockSelection(state => state.blockSelection.getSettings);
  const clearSelection = useBlockSelection(state => state.blockSelection.clearSelection);

  if (!selectedBlock) {
    return (
      <div className={cn("flex h-full items-center justify-center p-4", className)}>
        <p className="text-muted-foreground text-sm">
          Select a block to edit settings
        </p>
      </div>
    );
  }

  const blockType = selectedBlock.type === 'dashboard-panel'
    ? `dashboard-panel:${getPanelType(selectedBlock)}`
    : `standalone-block:${selectedBlock.id}`;

  const SettingsComponent = getSettings(blockType);

  if (!SettingsComponent) {
    return (
      <div className={cn("flex h-full items-center justify-center p-4", className)}>
        <p className="text-muted-foreground text-sm">
          No settings available for this block
        </p>
      </div>
    );
  }

  const handleClose = () => {
    onClose?.();
    clearSelection();
  };

  return (
    <div className={className}>
      <SettingsComponent
        blockId={selectedBlock.id}
        dashboardId={selectedBlock.dashboardId}
        onClose={handleClose}
      />
    </div>
  );
}
```

**Helper Function:**

```typescript
function getPanelType(selectedBlock: SelectedBlock): string {
  // Read from store to get panel type
  const dashboard = store
    .getState()
    .mosaicDashboard.getDashboard(selectedBlock.dashboardId!);
  const panel = dashboard?.panels.find((p) => p.id === selectedBlock.id);
  return panel?.type ?? 'unknown';
}
```

### 5. Chart Settings Integration

**ChartSettingsComponent:**

```typescript
function ChartSettingsComponent({
  blockId,
  dashboardId,
  onClose
}: BlockSettingsComponentProps) {
  const panel = useStoreWithMosaicDashboard(state => {
    const dashboard = state.mosaicDashboard.getDashboard(dashboardId!);
    return dashboard?.panels.find(p => p.id === blockId);
  });

  const chartTypes = useStoreWithMosaicDashboard(
    state => state.mosaicDashboard.chartTypes
  );

  if (!panel || panel.type !== 'vgplot') {
    return null;
  }

  const chartType = chartTypes?.find(ct => ct.id === panel.config.chartType);
  const SettingsComponent = chartType?.settingsComponent;

  if (!SettingsComponent) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">
          No settings available for {panel.config.chartType}
        </p>
      </div>
    );
  }

  // Pass through to chart-specific settings component
  // Chart definitions already expect {dashboardId, panel, onClose}
  return (
    <SettingsComponent
      dashboardId={dashboardId!}
      panel={panel}
      onClose={onClose}
    />
  );
}
```

This component bridges between the generic `BlockSettingsComponent` interface and the chart-specific settings components defined in chart type definitions.

### 6. Map Settings Integration

**MapSettingsComponent:**

```typescript
function MapSettingsComponent({
  blockId,
  dashboardId,
  onClose
}: BlockSettingsComponentProps) {
  const panel = useStoreWithMosaicDashboard(state => {
    const dashboard = state.mosaicDashboard.getDashboard(dashboardId!);
    return dashboard?.panels.find(p => p.id === blockId);
  });

  if (!panel) return null;

  // MapSettingsPanel already exists in @sqlrooms/deck
  return <MapSettingsPanel dashboardId={dashboardId!} panel={panel} onClose={onClose} />;
}
```

## Data Flow

```
User clicks panel
  ↓
SelectablePanelWrapper.onClick
  ↓
blockSelection.selectBlock({type: 'dashboard-panel', id, dashboardId})
  ↓
Zustand state update
  ↓
SelectablePanelWrapper re-renders with ring-2 ring-primary
BlockSettingsPanel re-renders with settings for selected block
  ↓
User clicks outside
  ↓
document click handler (in SelectablePanelWrapper)
  ↓
blockSelection.clearSelection()
  ↓
Visual ring removed, BlockSettingsPanel shows empty state
```

## Component Structure

```
packages/
  block-selection/
    src/
      BlockSelectionSlice.ts          # Zustand slice
      useBlockSelection.ts            # Hook to access slice
      BlockSettingsPanel.tsx          # Main settings panel component
      SelectablePanelWrapper.tsx      # Wrapper for selectable panels
      ChartSettingsComponent.tsx      # Chart settings bridge
      MapSettingsComponent.tsx        # Map settings bridge
      index.ts
    package.json
```

## Usage Examples

**Example 1: Dashboard with right sidebar**

```typescript
function DashboardWithSettings() {
  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0">
        <MosaicDashboard dashboardId="my-dashboard" />
      </div>
      <BlockSettingsPanel className="w-80 border-l bg-background" />
    </div>
  );
}
```

**Example 2: Block Document with floating settings**

```typescript
function BlockDocumentWithSettings() {
  const selectedBlock = useBlockSelection(state => state.blockSelection.selectedBlock);

  return (
    <div className="relative h-full">
      <BlockDocumentEditor documentId="doc-1">
        <BlockDocumentEditor.Content />
      </BlockDocumentEditor>

      {selectedBlock && (
        <div className="absolute top-4 right-4 w-80 rounded-lg border bg-background shadow-lg">
          <BlockSettingsPanel />
        </div>
      )}
    </div>
  );
}
```

**Example 3: Registering custom block settings**

```typescript
function MyCustomBlock() {
  const registerSettings = useBlockSelection(
    (state) => state.blockSelection.registerSettings,
  );

  useEffect(() => {
    registerSettings('standalone-block:custom', CustomBlockSettings);
    return () => unregisterSettings('standalone-block:custom');
  }, []);

  // ...
}
```

## Migration Path

**Phase 1: Core Infrastructure**

1. Create `packages/block-selection/` with slice, hooks, and components
2. Add slice to room store initialization
3. Create `ChartSettingsComponent` and `MapSettingsComponent` bridges

**Phase 2: Dashboard Integration** 4. Modify `MosaicDashboardPanels` to wrap panels with `SelectablePanelWrapper` 5. Register chart and map settings in dashboard initialization 6. Test selection, visual feedback, and settings display

**Phase 3: Deprecation (optional, later)** 7. Consider deprecating inline settings panels in individual panel renderers (like map's MosaicDashboardPanelLayout) 8. Move to unified sidebar pattern across all panels

## Open Questions

None — all clarifications received from user.

## Verification

**Manual Testing:**

1. Click on a chart panel → verify ring appears and settings show in `BlockSettingsPanel`
2. Click on same panel again → verify ring disappears and settings hide (toggle)
3. Click on different panel → verify selection moves to new panel
4. Click outside panels → verify selection clears
5. Focus a panel with keyboard (Tab) → verify selection works
6. Open chart settings → change a field → verify chart updates
7. Close settings via onClose → verify selection clears

**Integration Tests:**

- Test `selectBlock()`, `clearSelection()`, `isBlockSelected()` API
- Test settings registry: register, get, unregister
- Test that clicking updates Zustand state correctly
- Test that ChartSettingsComponent finds correct chart definition

## Dependencies

- Existing: `@sqlrooms/room-store`, `@sqlrooms/mosaic`, `@sqlrooms/deck`, `@sqlrooms/ui`
- New: `@sqlrooms/block-selection`

## References

- Existing map settings: `packages/deck/src/MapSettings.tsx`
- Chart definitions: `packages/mosaic/src/charts/chart-types/*/definition.ts`
- Panel renderers: `packages/mosaic/src/dashboard/MosaicDashboardSlice.ts`
