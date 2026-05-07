Layout slice and renderer for SQLRooms panel-based UIs.

This package renders layout trees using `react-resizable-panels` for split layouts, `dnd-kit` for dockable panel rearrangement, and `react-grid-layout` for scrollable grid dashboard layouts.

## Installation

```bash
npm install @sqlrooms/layout
```

## Main exports

- `createLayoutSlice()`, `useStoreWithLayout()`
- `LayoutRenderer` component — renders a `LayoutNode` tree using resizable panels, tabs, and generic docking
- `useExpandGridPanel()` — expands a grid child panel horizontally to available row space
- Grid layout defaults/helpers: `DEFAULT_GRID_COLS`, `DEFAULT_GRID_BREAKPOINTS`, `getResponsiveGridCols()`, `getGridColsForBreakpoint()`
- Layout helpers:
  - `visitLayoutLeafNodes`
  - `getVisibleLayoutPanels`
  - `removeLayoutNodeByKey`
  - `findNodeById`, `findTabsNodeForPanel`
  - `movePanel`
- Layout config schemas/types re-exported from `@sqlrooms/layout-config`

## Store usage

```tsx
import {LayoutSliceState, createLayoutSlice} from '@sqlrooms/layout';
import {
  BaseRoomStoreState,
  createBaseRoomSlice,
  createRoomStore,
} from '@sqlrooms/room-store';

function DataPanel() {
  return <div>Data</div>;
}

function MainPanel() {
  return <div>Main</div>;
}

type State = BaseRoomStoreState & LayoutSliceState;

export const {roomStore, useRoomStore} = createRoomStore<State>(
  (set, get, store) => ({
    ...createBaseRoomSlice()(set, get, store),
    ...createLayoutSlice({
      config: {
        type: 'split',
        direction: 'row',
        children: [
          {type: 'panel', id: 'data', defaultSize: '30%'},
          {type: 'panel', id: 'main', defaultSize: '70%'},
        ],
      },
      panels: {
        data: {
          title: 'Data',
          component: DataPanel,
        },
        main: {
          title: 'Main',
          component: MainPanel,
        },
      },
    })(set, get, store),
  }),
);
```

## Render callbacks

`createLayoutSlice` accepts optional render callbacks for custom panel and tab strip rendering:

```ts
createLayoutSlice({
  config: {
    /* ... */
  },
  panels: {
    /* ... */
  },
  renderPanel: (context) => {
    // Return custom JSX or undefined to fall back to the default renderer
  },
});
```

## Area-based panel management

Named `tabs` nodes (with an `id`) act as **areas** that can be managed programmatically:

```tsx
import {Button} from '@sqlrooms/ui';

function PanelButtons() {
  const setActiveTab = useRoomStore((state) => state.layout.setActiveTab);
  const addTab = useRoomStore((state) => state.layout.addTab);
  const setCollapsed = useRoomStore((state) => state.layout.setCollapsed);

  return (
    <div className="flex gap-2">
      <Button onClick={() => setActiveTab('sidebar', 'data')}>
        Show Data Panel
      </Button>
      <Button onClick={() => addTab('sidebar', 'schema')}>
        Add Schema Tab
      </Button>
      <Button onClick={() => setCollapsed('sidebar', true)}>
        Collapse Sidebar
      </Button>
    </div>
  );
}
```

## Note

`@sqlrooms/layout` (panel layout system) is different from `@sqlrooms/mosaic` (UW IDL data visualization package).
