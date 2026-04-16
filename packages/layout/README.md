Layout slice and renderer for SQLRooms panel-based UIs.

This package renders layout trees using `react-resizable-panels` for split/tabs and `react-mosaic-component` for drag-and-drop mosaic nodes.

## Installation

```bash
npm install @sqlrooms/layout
```

## Main exports

- `createLayoutSlice()`, `useStoreWithLayout()`
- `LayoutRenderer` component — renders a `LayoutNode` tree using resizable panels and tabs
- `MosaicLayout` component — legacy mosaic-only renderer (kept for backward compat)
- Layout helpers:
  - `makeLayoutStack`
  - `visitLayoutLeafNodes`
  - `getVisibleLayoutPanels`
  - `findLayoutNodePathByKey`
  - `removeLayoutNodeByKey`
  - `findAreaById`, `findSplitById`, `findMosaicNodeById`
- Layout config schemas/types re-exported from `@sqlrooms/layout-config`

## Store usage

```tsx
import {LayoutSliceState, MAIN_VIEW, createLayoutSlice} from '@sqlrooms/layout';
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
        children: [{type: 'panel', id: 'data', defaultSize: '30%'}, MAIN_VIEW],
      },
      panels: {
        data: {
          title: 'Data',
          component: DataPanel,
          area: 'sidebar',
        },
        main: {
          title: 'Main',
          component: MainPanel,
          area: 'main',
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
  const setActivePanel = useRoomStore((state) => state.layout.setActivePanel);
  const addPanelToArea = useRoomStore((state) => state.layout.addPanelToArea);
  const setAreaCollapsed = useRoomStore(
    (state) => state.layout.setAreaCollapsed,
  );

  return (
    <div className="flex gap-2">
      <Button onClick={() => setActivePanel('sidebar', 'data')}>
        Show Data Panel
      </Button>
      <Button onClick={() => addPanelToArea('sidebar', 'schema')}>
        Add Schema Tab
      </Button>
      <Button onClick={() => setAreaCollapsed('sidebar', true)}>
        Collapse Sidebar
      </Button>
    </div>
  );
}
```

## Note

`@sqlrooms/layout` (panel layout system) is different from `@sqlrooms/mosaic` (UW IDL data visualization package).
