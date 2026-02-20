---
outline: deep
---

# What's New

New features, improvements, and notable changes in each SQLRooms release. For migration steps and breaking changes, see the [Upgrade Guide](/upgrade-guide).

## 0.27.0

### `@sqlrooms/data-table`: RowSelection API

`DataTablePaginated` now includes a first-class row selection API with checkbox support.

- `enableRowSelection`: enables the checkbox column
- `rowSelection`: controlled row selection state
- `onRowSelectionChange`: callback fired when selection changes

Checkbox clicks are handled independently from row click handlers, so selecting via checkbox does not double-toggle rows.

<img src="/media/whats-new/row-selection.png" alt="SQLRooms DataTable row selection with checkboxes" width=450>

Example:

```tsx
import {RowSelectionState} from '@sqlrooms/data-table';
import {useState} from 'react';

const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

<DataTablePaginated
  {...arrowTableData}
  enableRowSelection={true}
  rowSelection={rowSelection}
  onRowSelectionChange={setRowSelection}
  onRowClick={({row}) => {
    setRowSelection((prev) => ({
      ...prev,
      [row.index]: !prev[row.index],
    }));
  }}
/>;
```


### `@sqlrooms/room-store`: bound `useRoomStore` API + `useRoomStoreApi`

`useRoomStore` now exposes imperative Zustand store methods (`getState`, `setState`, `subscribe`, `getInitialState`) in addition to selector usage. This makes event handlers and async callbacks more ergonomic while preserving existing reactive selector patterns.

For context-based access, use the new `useRoomStoreApi()` hook to read/write state imperatively from components wrapped in `RoomStateProvider`.

### Introducing MosaicSlice

A new centralized state management system for Mosaic integration. The `MosaicSlice` provides a unified way to manage Mosaic connections, coordinate cross-filtering between visualizations, and create reactive data queries that automatically update based on user selections.

<video src="/media/examples/sqlrooms-deckgl-mosaic-1500px.mp4" alt="SQLRooms Deck.gl+Mosaic example app" width="450" controls loop muted></video>

Key features:

- Automatic connection management with DuckDB
- Named selections for cross-filtering between multiple visualizations
- `useMosaicClient` hook for custom visualization clients
- Support for custom visualizations that respond to Mosaic selections

See the [Mosaic API documentation](/api/mosaic/) for details and check out the [DeckGL + Mosaic example](examples#deck-gl-mosaic) for a complete implementation.

### Additional 0.27.0 highlights

- **AI**: parallel sessions, persisted open session tabs, provider options, prompt suggestion improvements, inline API-key prompt in chat, and output copy-to-clipboard.
- **Vega/Charts**: actions toolbar, chart sizing fixes, improved SQL error display, hover-only chart actions, and responsive chart labels.
- **Kepler**: configurable injector with custom recipes, legend/timeline fixes, and stability improvements across integration edge cases.
- **Room/store + persistence**: `storeKey` support in `createRoomStore` and `persistSliceConfigs` helper improvements.
- **SQL/editor + query UX**: improved explain output, query panel/tab mapping fixes, and query cancellation support in create-table flows.


## 0.26.1-rc.7 (2025-12-05)

### Replaced barrel exports across all modules

Barrel exports (i.e., `export * from ...`) were replaced across all modules to improve tree-shaking, reduce bundle size, and avoid import path ambiguities. Direct/explicit exports now ensure only the required symbols are included in consumers' builds, making dependencies clearer and preventing accidental re-exports or circular dependencies.

Additionally, `"sideEffects": false` was added to all packages. This signals to bundlers that the modules are free of side effects, enabling better tree-shaking and further reducing the final bundle size.

### TabStrip component in `@sqlrooms/ui`

A composable tab strip with drag-to-reorder, inline renaming, and a search dropdown for reopening closed tabs. Supports custom tab menus and flexible layouts via subcomponents (`TabStrip.Tabs`, `TabStrip.SearchDropdown`, `TabStrip.NewButton`).

New: the search dropdown can optionally sort items by recent usage via `sortSearchItems="recent"` and an optional `getTabLastOpenedAt` accessor.

<video src="/media/whats-new/tab-strip-component.mp4" alt="SQLRooms TabStrip component" width="450" loop muted controls autoplay></video>

### Kepler integration

Added [Kepler.gl](https://kepler.gl/) integration module for geospatial data visualization.

<img src="/media/examples/kepler.webp" alt="SQLRooms Kepler.gl geospatial visualization example" width=450>

Check the [Kepler example](https://github.com/sqlrooms/examples/tree/main/kepler)

### AI RAG module

New `@sqlrooms/ai-rag` module for Retrieval Augmented Generation. Query your documentation using vector similarity search powered by DuckDB's native vector capabilities.

<img src="/media/examples/rag.webp" alt="SQLRooms AI RAG example" width=450>

Check the [AI RAG example](https://github.com/sqlrooms/examples/tree/main/ai-rag)

## 0.26.0 (2025-11-17)

### AI SDK v5

We migrated to Vercel AI SDK v5. Now supporting agents: check the [ai-agent example](https://github.com/sqlrooms/sqlrooms/tree/main/examples/ai-agent)
