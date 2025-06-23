---
outline: deep
---

# Overview

SQLRooms provides a comprehensive foundation and rich set of building blocks for creating modern, interactive data-analytics applications that can run entirely in the browser.
At its core is the concept of a **_Room_** — a self‑contained workspace where data lives, analysis happens, and (soon) collaborators meet. It combines essential components like a SQL query engine (DuckDB), data visualization tools, state management, and UI components into a cohesive toolkit, making it significantly easier to create powerful analytics tools with or without a backend.

<a href="/examples">
  <img src="/media/overview/collage.webp" alt="SQLRooms example apps" width=600>
</a>

The framework is designed for developers building innovative data tools **and** it tackles several common analytics challenges:

- Interactive data analysis tools
- Custom BI solutions
- Data visualization applications
- Internal analytics dashboards

Explore the [Examples](/examples) gallery or the [Case Studies](/case-studies) for real‑world setups.

## Why SQLRooms?

- **Performance & Scale:** Each user gets an in‑browser DuckDB instance with columnar speed and zero backend load.
- **Modular Architecture:** Mix-and-match packages and combine state _slices_ to include only the functionality you need.
- **AI‑Powered Analytics:** Use agents that can write and execute SQL queries, and generate insights directly in your browser.

## Why Local first?

_Local-first_ means your data and computation stay on your device, not on a remote server. This approach is inspired by the [Local-first Software](https://www.inkandswitch.com/essay/local-first) principles from Ink & Switch, emphasizing user ownership, privacy, and speed.

- **Privacy:** All data can stay client‑side for simplified compliance and peace of mind—nothing leaves your device unless you choose.
- **Own Your Data:** You control your files and data, with no vendor lock-in or forced cloud storage.
- **Fast Local Querying:** Queries run instantly in your browser, with no network roundtrip or server lag.
- **Private AI Insights:** AI agents generate insights and run queries locally, so your data does not have to be shared with external model providers.

## Modular Architecture

SQLRooms is designed with a modular architecture that allows developers to pick and choose exactly the functionality they need for their data analytics applications. This approach enables you to build custom solutions tailored to your specific requirements.

<img src="/media/overview/architecture.svg" alt="SQLRooms Architecture" width=600>

## Key Concepts

### What's a Room?

A **Room** is a self-contained workspace where users can explore datasets, run queries, and view results. The term comes from collaborative tools—where users work in shared spaces—and SQLRooms is built with future real-time collaboration in mind.

A Room consists of:

- `<RoomShell>`: a React component that renders the Room UI
- `roomStore`: a Zustand-based state store for the Room

---

### Room Store

The `roomStore` is a [composable](#composing-store-from-slices) [`Zustand`](/state-management#why-zustand) store created by calling `createRoomStore()`. The store holds:

- `config`: the persistable part of the state that captures a Room's saveable settings and can be serialized to JSON for storage or sharing including:
  - the view configuration and the layout state
  - the user preferences
- `room`: non-persistable state that holds runtime information like:
  - loaded DuckDB tables
  - transient UI state (like "query running")

```tsx
const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice<RoomConfig>({
      config: {
        dataSources: [
          {
            type: 'url',
            url: 'https://.../earthquakes.parquet',
            tableName: 'earthquakes',
          },
        ],
      },
      room: {
        // Runtime state initialization…
      },
    })(set, get, store),
  }),
);
```

Check the [minimal example](https://github.com/sqlrooms/examples/blob/main/minimal/src/app.tsx) for the complete implementation.

---

### RoomShell

`<RoomShell>` is a React component that wraps your Room UI

- It injects the `roomStore` into React context, accessible via the `useRoomStore()` hook
- It sets up essential UI infrastructure including error boundaries, toast notifications, and tooltips, making it easy to use components from `@sqlrooms/ui` out of the box
- It provides slots for the optional `LayoutComposer` (see [Layout](#layout-optional) section below), `Sidebar`, and `LoadingProgress` components

```tsx
const App = () => (
  <RoomShell roomStore={roomStore}>
    <MyComponent />
  </RoomShell>
);
```

---

### SQL and DuckDB Access

SQLRooms includes a built-in DuckDB integration via the [`DuckDbSlice`](/api/duckdb/).
The `DuckDbSlice` provides helper functions for managing and querying tables:

- `findTableByName()` - Look up a table by name in the current schema
- `addTable()` - Add a new table from Arrow data or records
- `dropTable()` - Remove a table from the database
- `refreshTableSchemas()` - Update the cached table schemas
- `tables` - The cached list of tables from the last refreshTableSchemas() call
- `getConnector()` - Access the underlying DuckDB connector

You can query your datasets using the `useSql(query)` hook and work directly with Arrow tables in React.

```tsx
function MyComponent() {
  const isTableReady = useRoomStore((state) =>
    Boolean(state.db.findTableByName('earthquakes')),
  );
  const queryResult = useSql<{maxMagnitude: number}>({
    query: `SELECT max(Magnitude) AS maxMagnitude FROM earthquakes`,
    enabled: isTableReady,
  });
  const row = queryResult.data?.toArray()[0];
  return row ? `Max earthquake magnitude: ${row.maxMagnitude}` : <Spinner />;
}
```

For more details on DuckDB integration and available methods, see the [DuckDB API Reference](/api/duckdb/).

---

### Composing Store from Slices

The store can be enhanced with **slices**—modular pieces of state and logic that can be added to your Room. You can use slices from the `@sqlrooms/*` packages or create your own custom slices. Each slice is a function that returns a partial state object along with methods to modify that state.

Here's an example showing how to combine the default room shell with SQL editor functionality:

```tsx
const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>({
  // Default slice
  ...createRoomShellSlice<RoomConfig>({
    config: {
      // Add SQL editor slice persistable config
      ...createDefaultSqlEditorConfig(),
    },
    room: {},
  })(set, get, store),

  // Mix in sql editor slice
  ...createSqlEditorSlice()(set, get, store),
});
```

You can access slices' namespaced config, state and functions in the store using selectors, for example:

```tsx
const queries = useRoomStore((state) => state.config.sqlEditor.queries);
const runQuery = useRoomStore((state) => state.sqlEditor.parseAndRunQuery);
```

Learn more about store and slices in [State Management](/state-management).

---

### Layout (Optional)

The `LayoutComposer` provides a flexible panel layout for your Room's UI.

- Panels are React components that can be plugged into the layout. They include metadata (`id`, `title`, `icon`) and a `component` to render.
- Panels can be moved, resized, or hidden
- Developers can add panels by registering them in the `roomStore`.
- Layout state is persisted in the `roomStore`

Configure the room layout and panels during store initialization:

```tsx
const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice<RoomConfig>({
      config: {
        layout: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            // Data panel on left (30%) and main view on right
            direction: 'row',
            first: 'data-panel',
            second: MAIN_VIEW,
            splitPercentage: 30,
          },
        },
      },
      room: {
        // Define the available panels in the room layout
        panels: {
          'data-panel': {
            title: 'Data Sources',
            icon: DatabaseIcon,
            component: DataSourcesPanel,
            placement: 'sidebar',
          },
          main: {
            title: 'Main view',
            icon: () => null,
            component: MainView,
            placement: 'main',
          },
        },
      },
    })(set, get, store),
  }),
);
```

Layout composer renders the mosaic layout with panels:

```tsx
function App() {
  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.Sidebar />
      <RoomShell.LayoutComposer />
    </RoomShell>
  );
}
```

For more details on layout configuration and customization, see the [Layout API Reference](/api/layout/).

## Next Steps

- **Check the [Example applications](/examples)** to see what can be built with the framework.

- **Quick start the [Getting Started Guide](/getting-started)** to set up your first room.

- **Read the [API reference](/packages/)** for deeper integration.
