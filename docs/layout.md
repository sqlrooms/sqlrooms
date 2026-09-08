---
outline: deep
---

# Layout

SQLRooms layouts compose React panels into resizable splits, tabs, dashboard
grids, and docking workspaces. The layout tree lives in `layout.config`; the
React components and their titles live in the `layout.panels` registry.

Explore the [layout example](https://github.com/sqlrooms/examples/tree/main/layout)
for a complete app with collapsible sidebars, custom tab strips, and dynamically
created dock and grid dashboards. In the SQLRooms repository, run it with:

```sh
pnpm install
pnpm build
pnpm dev layout-example
```

## Choose a layout

| Node    | Use it for                                                     |
| ------- | -------------------------------------------------------------- |
| `panel` | One React surface, such as a chart, editor, or document        |
| `split` | Side-by-side (`row`) or stacked (`column`) resizable children  |
| `tabs`  | Switching between panels or entire nested layouts              |
| `grid`  | A scrollable dashboard with draggable, resizable tiles         |
| `dock`  | A workspace where users rearrange panels into resizable splits |

Each container can contain other layout nodes. For example, a split can hold a
sidebar and a tabs node whose children are a grid and a dock workspace.
Documents are content rendered inside panels; there is no `doc` layout node.

## Register panels and render a split

This example assumes an app with SQLRooms styling already configured, as in
[Getting Started](https://sqlrooms.org/getting-started.html).
`createRoomShellSlice()` includes the layout slice, and
`RoomShell.LayoutComposer` connects rendering and layout changes to the store.

```tsx
import {
  LeafLayout,
  type LayoutConfig,
  type RoomPanelComponent,
} from '@sqlrooms/layout';
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShell,
  type RoomShellSliceState,
} from '@sqlrooms/room-shell';

const DataPanel: RoomPanelComponent = () => (
  <div className="p-4">Data sources</div>
);

const ChartPanel: RoomPanelComponent = ({meta, panelInfo}) => (
  <>
    <LeafLayout.Header>
      <LeafLayout.DragHandle className="border-b p-2">
        {panelInfo.title}
      </LeafLayout.DragHandle>
    </LeafLayout.Header>
    <div className="min-h-0 flex-1 overflow-auto p-4">
      Chart: {String(meta?.chartId ?? 'overview')}
    </div>
  </>
);

const splitLayout = {
  type: 'split',
  id: 'workspace',
  direction: 'row',
  children: [
    {
      type: 'panel',
      id: 'data-panel',
      panel: 'data',
      defaultSize: '25%',
      minSize: '200px',
    },
    {
      type: 'panel',
      id: 'overview-chart',
      panel: {key: 'chart', meta: {chartId: 'overview'}},
      defaultSize: '75%',
    },
  ],
} satisfies LayoutConfig;

export const {roomStore, useRoomStore} = createRoomStore<RoomShellSliceState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      layout: {
        config: splitLayout,
        panels: {
          data: {title: 'Data', component: DataPanel},
          chart: ({meta}) => ({
            title: `Chart: ${meta?.chartId ?? 'overview'}`,
            component: ChartPanel,
          }),
        },
      },
    })(set, get, store),
  }),
);

export function App() {
  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.LayoutComposer />
    </RoomShell>
  );
}
```

Give object nodes stable, unique `id` values. A panel's `id` identifies its
position in the layout tree; `panel` selects a registry entry. Using
`panel: {key, meta}` lets multiple instances share a renderer while receiving
different metadata. The `panelId` prop is the registry key, not the node ID.
A string leaf such as `'data'` is shorthand that uses the same value for both.
An object panel node needs an explicit `panel` to render its component.

Use percentage strings for proportional split sizes and pixel strings for
constraints such as `minSize`. Give the composer a parent with a defined height.
`LeafLayout.Header` shows the header in dock/grid contexts, and
`LeafLayout.DragHandle` supplies the drag target for those layouts.

The following configurations reuse this panel registry. To try one, pass it as
`layout.config` at initialization or call
`roomStore.getState().layout.setConfig(nextLayout)`.

## Tabs and collapsible areas

Use a named tabs node for an area that users can switch, close, or collapse.
Its `children` can be panels or nested layouts, and `activeTabIndex` selects the
initial tab.

```ts
const tabsLayout = {
  type: 'split',
  id: 'tabbed-workspace',
  direction: 'row',
  children: [
    {
      type: 'tabs',
      id: 'sidebar',
      children: ['data'],
      activeTabIndex: 0,
      defaultSize: '25%',
      minSize: '200px',
      collapsible: true,
      collapsedSize: 0,
    },
    {
      type: 'tabs',
      id: 'charts',
      activeTabIndex: 0,
      children: [
        {
          type: 'panel',
          id: 'sales-chart',
          panel: {key: 'chart', meta: {chartId: 'sales'}},
        },
        {
          type: 'panel',
          id: 'traffic-chart',
          panel: {key: 'chart', meta: {chartId: 'traffic'}},
        },
      ],
    },
  ],
} satisfies LayoutConfig;
```

Use the tabs node ID and child node ID when changing the active panel:

```ts
const layout = roomStore.getState().layout;
layout.setActiveTab('charts', 'traffic-chart');
layout.setCollapsed('sidebar', true);
layout.addTab('charts', {
  type: 'panel',
  id: 'retention-chart',
  panel: {key: 'chart', meta: {chartId: 'retention'}},
});
layout.removeTab('charts', 'sales-chart'); // Close; it can be reopened with addTab.
```

### Customize a tab strip

Register a component such as `chartTabs: {component: ChartTabs}`, then set
`panel: 'chartTabs'` on the `charts` tabs node above. Compose the built-in tab
parts inside that component to retain the layout context and store actions:

```tsx
import {TabsLayout} from '@sqlrooms/layout';

function ChartTabs() {
  return (
    <>
      <TabsLayout.TabStrip closeable preventCloseLastTab>
        <TabsLayout.SearchDropdown />
        <TabsLayout.Tabs />
      </TabsLayout.TabStrip>
      <TabsLayout.TabContentContainer>
        <TabsLayout.TabContent forceMount />
      </TabsLayout.TabContentContainer>
    </>
  );
}
```

`forceMount` keeps inactive visible tabs mounted, preserving component state and
setup work at the cost of keeping those components in memory. Omit it when that
is unnecessary. The layout example also demonstrates `TabsLayout.NewButton`
with `RoomShell.LayoutComposer`'s `onTabCreate` callback.

## Grid dashboards

A grid positions its children using column and row units. Each `layouts` entry
describes a breakpoint, and each item's `i` must match a child node's `id`.
This example puts charts side by side on wide screens and stacks them on small
screens:

```ts
const gridLayout = {
  type: 'grid',
  id: 'dashboard',
  breakpoints: {lg: 768, sm: 0},
  cols: {lg: 12, sm: 6},
  rowHeight: 160,
  margin: [12, 12],
  compactType: 'vertical',
  resizeHandles: ['e', 's', 'se'],
  children: [
    {
      type: 'panel',
      id: 'sales-chart',
      panel: {key: 'chart', meta: {chartId: 'sales'}},
    },
    {
      type: 'panel',
      id: 'traffic-chart',
      panel: {key: 'chart', meta: {chartId: 'traffic'}},
    },
  ],
  layouts: {
    lg: [
      {i: 'sales-chart', x: 0, y: 0, w: 6, h: 2},
      {i: 'traffic-chart', x: 6, y: 0, w: 6, h: 2},
    ],
    sm: [
      {i: 'sales-chart', x: 0, y: 0, w: 6, h: 2},
      {i: 'traffic-chart', x: 0, y: 2, w: 6, h: 2},
    ],
  },
} satisfies LayoutConfig;
```

`rowHeight` is in pixels; `w` and `h` are column and row counts. The renderer
provides scrolling and writes drag/resize changes back through the composer.
Omit `layouts` to use automatically generated initial positions. When adding
children to a grid with explicit positions, update the corresponding breakpoint
layouts too; the layout example shows this in `addChartToDashboard()`.

## Docking workspaces

Wrap a layout tree in a `dock` node to let users rearrange its panels by dragging
their handles to the left, right, top, or bottom of another panel. These drops
create or update splits within the dock. A dock stores its nested layout in
`root`, rather than `children`:

```ts
const dockLayout = {
  type: 'dock',
  id: 'analysis-dock',
  root: {
    type: 'split',
    id: 'analysis-split',
    direction: 'row',
    children: [
      {
        type: 'panel',
        id: 'sales-chart',
        panel: {key: 'chart', meta: {chartId: 'sales'}},
        defaultSize: '50%',
      },
      {
        type: 'panel',
        id: 'traffic-chart',
        panel: {key: 'chart', meta: {chartId: 'traffic'}},
        defaultSize: '50%',
      },
    ],
  },
} satisfies LayoutConfig;
```

`RoomShell.LayoutComposer` supplies the drag-and-drop infrastructure. Reuse the
`ChartPanel` with its `LeafLayout.DragHandle` from the first example to make
these panels draggable.

## Documents inside layouts

A document can occupy a panel, a tab, or a dashboard tile just like any other
React surface. For a document workspace, use `ArtifactTabs` and
`createArtifactPanelDefinition()` to connect layout panels to artifact IDs,
then render `BlockDocumentArtifact` inside the document panel.

See [Blocks and Block Documents](https://sqlrooms.org/blocks-and-documents.html#set-up-a-block-document-artifact)
for a complete store and panel example, including document state and embedded
stateful blocks. See [Artifacts](https://sqlrooms.org/artifacts.html) for
top-level workspace tabs and artifact lifecycle.

## Save and restore layouts

Layout interactions update `roomStore.getState().layout.config`. To preserve
them across reloads, include `layout: LayoutConfig` from `@sqlrooms/layout` in
your persistence `sliceConfigSchemas`. Persist the config tree and serializable
metadata, and register React components again when creating the store.

See [Persistence](https://sqlrooms.org/persistence.html) for storage setup.
For lower-level integration without `RoomShell`, use `createLayoutSlice()` and
`LayoutRenderer` from the [Layout API reference](https://sqlrooms.org/api/layout/).
