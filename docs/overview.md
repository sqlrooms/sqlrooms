---
outline: deep
---

# What's SQLRooms?

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

### What's a Room

A self‑contained workspace that you open to explore one or more datasets.  
It owns its own configuration, layout, open panels, visualizations, and unsaved edits—and it's future‑ready for real‑time collaboration so multiple users can work in the same room.

### Room Store

The single source of truth for a room's state. It holds everything React shouldn't keep in local component state:

- loaded tables / views
- panel layout metadata
- user preferences (theme, tab size, etc.)
- transient UI flags (e.g. "query running")

SQLRooms modules can add custom store state and functions via [slices](/state-management#understanding-slices), which are merged into the main roomStore.

The core slice in the Zustand store that holds a room's runtime state and actions. Its **config** sub-object is expressed as a Zod schema so it can be validated and persisted, and the slice can be merged with others (SQL Editor, AI, etc.) to form a single store. Learn more in [State Management](/state-management).

The store is exposed via `useRoomStore()` so any component can select or dispatch without prop‑drilling.

### Room Shell

`RoomShell` is the UI component that renders the whole room: the sidebar chrome, main layout, and overlays; acts as a context bridge injecting `roomStore` into React context for descendants; and orchestrates slots so child components auto‑position without worrying about order.

### Layout

The room's layout manager arranges all visible panels in a flexible grid (split-panes under the hood).  
Its configuration – sizes, positions, and open/closed state – lives in the `roomStore` so it can be persisted, reset, or synchronized across clients.  
Modules don't need to care how their UI is placed; they simply declare panels and the layout takes care of rendering them.

### Panels

A Panel is a self-contained React component (e.g. SQL editor, result table, chart) that plugs into the layout.  
Each panel provides metadata (id, title, icon) and a React component to render.  
Users can open, move, resize, and close panels at runtime; developers can create new panels to surface custom views or workflows.

### Why this structure?

- **Clear mental model:** "Open a room → explore your data."
- **Composable:** Developers can swap out or extend the Sidebar, Layout, or overlays without touching the shell.
- **Collaboration‑ready:** The store abstraction and shell boundaries map cleanly to future multi‑user sync.

## How create a custom module

A custom module typically bundles **state** (via a slice) with **UI** (via one or more panels) so it can be plugged into any room.

### Slice

Create a Zustand slice (e.g. `createMyModuleSlice`) that adds new state, selectors, and actions to the Room Store.  
Expose a `config` sub-object if you want part of that state to be persisted and validated.

### Panels

Build React components for the module's UI (tables, charts, wizards, etc.).  
Register them with the module so the Layout can discover them and users can open them from the sidebar or programmatically.

Combining the slice (logic/state) with the panels (presentation) lets you ship an encapsulated feature—like an AI assistant or advanced visualization toolkit—as a reusable package.

## Next Steps

- **Quick start the [Getting Started Guide](/getting-started)** to set up your first room.
- **Dive into the [Architecture Guide](/architecture)** to see how it all fits together.
- **Explore the [Examples](/examples)** gallery for real‑world setups.
- **Read the [API reference](/api/room-shell/)** for deeper integration.

## Conclusion

SQLRooms provides a powerful foundation for building browser-based data analytics applications with no backend requirements. By combining DuckDB's SQL engine with modern web technologies, it enables developers to create performant, scalable, and privacy-focused data tools.

Ready to dive deeper? Check out our [Architecture Guide](/architecture) to understand how SQLRooms components work together and how you can leverage them in your applications.
