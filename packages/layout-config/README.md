Zod schemas and types for SQLRooms layout configuration (Mosaic layout).

## Installation

```bash
npm install @sqlrooms/layout-config
```

## Main exports

- `MAIN_VIEW`
- `LayoutTypes`
- `MosaicLayoutConfig`, `LayoutConfig`
- `MosaicLayoutNode`, `MosaicLayoutParent`, `isMosaicLayoutParent`
- `createDefaultMosaicLayout()`, `DEFAULT_MOSAIC_LAYOUT`

## Basic usage

```ts
import {
  LayoutConfig,
  MAIN_VIEW,
  MosaicLayoutConfig,
  createDefaultMosaicLayout,
} from '@sqlrooms/layout-config';

const minimalLayout = createDefaultMosaicLayout();

const twoPaneLayout: MosaicLayoutConfig = {
  type: 'mosaic',
  nodes: {
    direction: 'row',
    first: 'data',
    second: MAIN_VIEW,
    splitPercentage: 30,
  },
};

const validatedMinimal: LayoutConfig = LayoutConfig.parse(minimalLayout);
const validated: LayoutConfig = LayoutConfig.parse(twoPaneLayout);
```

## Typical integration

```ts
import {createRoomShellSlice} from '@sqlrooms/room-shell';
// `DataPanel` and `MainPanel` are app-level React components in your project.

createRoomShellSlice({
  layout: {
    config: twoPaneLayout,
    panels: {
      data: {title: 'Data', component: DataPanel, placement: 'sidebar'},
      main: {title: 'Main', component: MainPanel, placement: 'main'},
    },
  },
});
```
