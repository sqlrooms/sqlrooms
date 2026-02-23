Layout slice and mosaic utilities for SQLRooms panel-based UIs.

This package uses `react-mosaic` to compose resizable panel layouts.

## Installation

```bash
npm install @sqlrooms/layout
```

## Main exports

- `createLayoutSlice()`, `useStoreWithLayout()`
- `MosaicLayout` component
- mosaic helpers:
  - `makeMosaicStack`
  - `visitMosaicLeafNodes`
  - `getVisibleMosaicLayoutPanels`
  - `findMosaicNodePathByKey`
  - `removeMosaicNodeByKey`
- layout config schemas/types re-exported from `@sqlrooms/layout-config`

## Store usage

```tsx
import {
  LayoutSliceState,
  LayoutTypes,
  MAIN_VIEW,
  createLayoutSlice,
} from '@sqlrooms/layout';
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
        type: LayoutTypes.enum.mosaic,
        nodes: {
          direction: 'row',
          first: 'data',
          second: MAIN_VIEW,
          splitPercentage: 30,
        },
      },
      panels: {
        data: {
          title: 'Data',
          component: DataPanel,
          placement: 'sidebar',
        },
        main: {
          title: 'Main',
          component: MainPanel,
          placement: 'main',
        },
      },
    })(set, get, store),
  }),
);
```

## Programmatic panel visibility

```tsx
function PanelButtons() {
  const togglePanel = useRoomStore((state) => state.layout.togglePanel);
  const togglePanelPin = useRoomStore((state) => state.layout.togglePanelPin);

  return (
    <div className="flex gap-2">
      <button onClick={() => togglePanel('data')}>Toggle Data Panel</button>
      <button onClick={() => togglePanelPin('data')}>Pin/Unpin Data Panel</button>
    </div>
  );
}
```

## Note

`@sqlrooms/layout` (react-mosaic layout) is different from `@sqlrooms/mosaic` (UW IDL data visualization package).
