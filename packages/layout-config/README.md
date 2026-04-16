Zod schemas and types for SQLRooms layout configuration.

## Installation

```bash
npm install @sqlrooms/layout-config
```

## Main exports

- `MAIN_VIEW`
- `LayoutConfig` (`LayoutNode | null`)
- `LayoutNode`, `LayoutPanelNode`, `LayoutSplitNode`, `LayoutTabsNode`
- `isLayoutPanelNode`, `isLayoutSplitNode`, `isLayoutTabsNode`
- `createDefaultLayout()`

## Basic usage

```ts
import {
  LayoutConfig,
  LayoutNode,
  MAIN_VIEW,
  createDefaultLayout,
} from '@sqlrooms/layout-config';

// Simplest config — just the main view
const simpleLayout = createDefaultLayout(); // returns MAIN_VIEW

// Two-pane split layout
const twoPaneLayout: LayoutConfig = {
  type: 'split',
  direction: 'row',
  children: [{type: 'panel', id: 'data', defaultSize: '30%'}, MAIN_VIEW],
};

// Validated via Zod
const validated: LayoutConfig = LayoutConfig.parse(twoPaneLayout);
```

## Layout node types

`LayoutConfig` is `LayoutNode | null`. A `LayoutNode` is one of:

| Type     | Description                                                   |
| -------- | ------------------------------------------------------------- |
| `string` | Leaf panel key (e.g. `'main'`, `'data'`)                      |
| `panel`  | Leaf with sizing constraints (`defaultSize`, `minSize`, etc.) |
| `split`  | Resizable panel group (rendered via `react-resizable-panels`) |
| `tabs`   | Tabbed container with collapsible areas                       |

### Panel node

```ts
{type: 'panel', id: 'sidebar', defaultSize: '25%', minSize: '150px', collapsible: true}
```

### Split node

```ts
{
  type: 'split',
  direction: 'row',
  children: [
    {type: 'panel', id: 'left', defaultSize: '30%'},
    {type: 'panel', id: 'right'},
  ],
}
```

### Tabs node

```ts
{
  type: 'tabs',
  id: 'sidebar',
  children: ['data', 'schema'],
  activeTabIndex: 0,
  collapsible: true,
}
```

## Typical integration

```ts
import {createRoomShellSlice} from '@sqlrooms/room-shell';

createRoomShellSlice({
  layout: {
    config: twoPaneLayout,
    panels: {
      data: {title: 'Data', component: DataPanel, area: 'sidebar'},
      main: {title: 'Main', component: MainPanel, area: 'main'},
    },
  },
});
```

## Backward compatibility

Legacy binary-tree split configs are still migrated via `z.preprocess`, but the old `mosaic` node shape is no longer part of the public schema.
