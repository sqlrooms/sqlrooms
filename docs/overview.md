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

## Why SQLRooms?

- **Modular Architecture:** Mix-and-match packages and combine state _slices_ to include only the functionality you need. See the [Architecture Guide](/architecture) and [State Management](/state-management) docs for details.
- **Performance & Scale:** Each user gets an in‑browser DuckDB instance with columnar speed and zero backend load.
- **AI‑Powered Analytics:** Local SQL execution lets AI agents generate and run queries instantly.
- **Privacy & Security:** All data can stay client‑side for simplified compliance.

## Key Concepts

### What's a Room?

A **Room** is a self-contained workspace where users can explore datasets, run queries, and view results.  
The term comes from collaborative tools—where users work in shared spaces—and SQLRooms is built with future real-time collaboration in mind.

A Room consists of:

- `roomStore`: a Zustand-based state store for the Room
- `<RoomShell>`: a React component that renders the Room UI

---

### RoomShell and Room Store

- `<RoomShell>` is a React component that wraps your Room UI in a `RoomStateProvider`
- It injects the `roomStore` into React context, accessible via the `useRoomStore()` hook
- The `roomStore` is a Zustand store that holds:
  - loaded DuckDB tables
  - layout state
  - user preferences
  - transient UI flags (like "query running")
  - `config`: the persistable slice of the store that captures a Room's saveable settings and can be serialized to JSON for storage or sharing

The store can be extended with additional **slices**—either from core `@sqlrooms/*` packages or your own custom modules.  
Learn more in [State Management](/state-management).

```tsx
import {RoomShell} from '@sqlrooms/room-shell';

const {roomStore, useRoomStore} = createRoomStore<AppConfig, AppState>(
  (set, get, store) => ({
    ...createRoomShellSlice<AppConfig>({
      config: {
      }
    ),

    // Store slices initialization
    // ...
  }),
);

export const App = () => {
  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <MyComponent />
    </RoomShell>
  );
};

function MyComponent = () => {
  const queryResult = useSql<{maxMagnitude: number}>({
    query: `
      SELECT max(Magnitude) AS maxMagnitude
      FROM 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/earthquakes.parquet'
    `
  });
  const row = data?.toArray()[0];
  return (
    <div className="w-full h-full align-center justify-center">
     {row ? `Max earthquake magnitude: ${row.maxMagnitude}` : 'Loading…'}
    </div>
  )
}
```

---

### SQL and DuckDB Access

SQLRooms includes a built-in DuckDB integration via the `DuckDbSlice`.  
You can query your datasets using the `useSql(query)` hook and work directly with Arrow tables in React.

---

### Layout (Optional)

The `LayoutComposer` provides a flexible panel layout for your Room's UI.

- Panels are React components that can be plugged into the layout. They include metadata (`id`, `title`, `icon`) and a component to render.
- Panels can be moved, resized, or hidden
- Developers can add panels by registering them in the `roomStore`.
- Layout state is persisted in the `roomStore`

---

## Next Steps

- **Quick start the [Getting Started Guide](/getting-started)** to set up your first room.
- **Dive into the [Architecture Guide](/architecture)** to see how it all fits together.
- **Explore the [Examples](/examples)** gallery for real‑world setups.
- **Read the [API reference](/api/room-shell/)** for deeper integration.
