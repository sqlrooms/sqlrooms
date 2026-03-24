---
outline: deep
---

# What's New

New features, improvements, and notable changes in each SQLRooms release. For migration steps and breaking changes, see the [Upgrade Guide](/upgrade-guide).

## 0.29.0 (upcoming)

### Sonner toast integration\*\*

`Toaster` now renders [Sonner](https://sonner.emilkowal.ski/) with SQLRooms theme-aware styling, and examples now use Sonner notifications instead of `useToast` in file-upload flows. `@sqlrooms/ui` also exports Sonner's `toast` function directly for app-level notifications.

### Command system enhancements

- **Command keystrokes**: Commands can now declare `ui.keystrokes` (single key combo or array). Keystrokes are shown in the command palette and can trigger commands directly when the palette is mounted.
- **Middleware pipeline**: `createCommandSlice` now supports command middleware via `createCommandProps` (`(command, input, context, next)`), enabling clean telemetry, feature-flag, and confirmation layers without modifying `invokeCommand`.
- **Telemetry hooks**: `createCommandProps` supports invocation lifecycle callbacks (`onCommandInvokeStart`, `onCommandInvokeSuccess`, `onCommandInvokeFailure`, `onCommandInvokeError`) for centralized instrumentation.
- **Room shell wiring**: `createRoomShellSlice` now accepts `createCommandProps` and passes it to `createCommandSlice`, so shell-based apps can configure command middleware/telemetry from one place.
- **Coverage + docs**: Added expanded unit tests for command execution/middleware behavior and a new Developer Guide page: [Commands](/commands).

## 0.28.0

- **Tailwind v4**: SQLRooms now uses Tailwind v4, including the new CSS-first setup that simplifies project styling and configuration ([#324](https://github.com/sqlrooms/sqlrooms/pull/324)). For Tailwind migration details, jump to the [upgrade guide](/upgrade-guide#tailwind-v3-to-v4).
- **Cosmos.gl upgrade**: updates the [Cosmos.gl](https://cosmos.gl) integration to include the latest improvements in this powerful graph visualization library ([#379](https://github.com/sqlrooms/sqlrooms/pull/379))
- **Command system implementation**: Command Palette UI added to shells (toggle with `Ctrl/Cmd+K`, sidebar button, searchable/grouped commands, per-command shortcuts, JSON input editor, and programmatic open/close controls). A global command system and tooling is also introduced to register, list, validate, and execute commands, with adapters for CLI/MCP and AI tool integrations, plus DB and editor command sets ([#382](https://github.com/sqlrooms/sqlrooms/pull/382))

<video src="/media/whats-new/commands.mp4" alt="SQLRooms command system and command palette" width="450" loop muted controls autoplay></video>

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
