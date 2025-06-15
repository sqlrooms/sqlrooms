# <img src=https://github.com/user-attachments/assets/dd6b2929-29f5-4c8b-a0c0-51ec84603e6b width=23> SQLRooms

Building blocks for React data analytics applications powered by [DuckDB](https://duckdb.org/docs/api/wasm/overview.html)

[Documentation](https://sqlrooms.org/) | [Examples](https://sqlrooms.org/examples.html)

<!-- INCLUDE:overview.md -->

# Overview

SQLRooms provides a comprehensive foundation and rich set of building blocks for creating modern, interactive data-analytics applications that can run entirely in the browser.
At its core is the concept of a **_Room_** — a self‑contained workspace where data lives, analysis happens, and (soon) collaborators meet. It combines essential components like a SQL query engine (DuckDB), data visualization tools, state management, and UI components into a cohesive toolkit, making it significantly easier to create powerful analytics tools with or without a backend.

<a href="/examples">
  <img src="docs/media/overview/collage.webp" alt="SQLRooms example apps" width=600>
</a>

The framework is designed for developers building innovative data tools **and** it tackles several common analytics challenges:

- Interactive data analysis tools
- Custom BI solutions
- Data visualization applications
- Internal analytics dashboards

## Why SQLRooms?

- **Modular Architecture:** Mix-and-match packages and combine state _slices_ to include only the functionality you need. See the [Architecture Guide](http://sqlrooms.org/architecture) and [State Management](http://sqlrooms.org/state-management) docs for details.
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
Learn more in [State Management](http://sqlrooms.org/state-management).

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

- **Quick start the [Getting Started Guide](http://sqlrooms.org/getting-started)** to set up your first room.
- **Dive into the [Architecture Guide](http://sqlrooms.org/architecture)** to see how it all fits together.
- **Explore the [Examples](http://sqlrooms.org/examples)** gallery for real‑world setups.
- **Read the [API reference](http://sqlrooms.org/api/room-shell/)** for deeper integration.

<!-- END:overview.md -->

<!-- INCLUDE:getting-started.md -->

# Getting Started with SQLRooms

SQLRooms is a powerful framework and a set of building blocks for creating DuckDB-backed analytics applications in React. This guide will help you integrate SQLRooms into your application. For a detailed overview of the framework's architecture, check out the [Overview](http://sqlrooms.org/overview) page.

## Try the Minimal Example

To create a new project from the get-started example run this:

```bash
npx degit sqlrooms/examples/get-started myapp/
cd myapp
npm install
npm run dev
```

This basic Vite application demonstrates loading a CSV data source and running SQL queries with `useSql()`.

## Manual Setup

### Prerequisites

Your application should have the following dependencies:

- [React 18](https://react.dev/) or higher
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://zustand.docs.pmnd.rs) for state management
- [Zod](https://zod.dev) for schema validation
- [Node.js](https://nodejs.org/) >= 20

### Installation

Install the required SQLRooms packages:

::: code-group

```bash [npm]
npm install @sqlrooms/room-shell @sqlrooms/room-config @sqlrooms/layout @sqlrooms/ui
```

```bash [pnpm]
pnpm add @sqlrooms/room-shell @sqlrooms/room-config @sqlrooms/layout @sqlrooms/ui
```

```bash [yarn]
yarn add @sqlrooms/room-shell @sqlrooms/room-config @sqlrooms/layout @sqlrooms/ui
```

:::

### Configure Tailwind CSS

SQLRooms provides a Tailwind preset that includes all the necessary styles. Update your `tailwind.config.js` or `tailwind.config.ts`:

```typescript
import {sqlroomsTailwindPreset} from '@sqlrooms/ui';
import type {Config} from 'tailwindcss';

const preset = sqlroomsTailwindPreset();
const config = {
  ...preset,
  content: [
    // Your content paths...
    './src/**/*.{ts,tsx}',
    // Add SQLRooms packages to content paths
    './node_modules/@sqlrooms/**/dist/**/*.js',
  ],
  theme: {
    ...preset.theme,
    extend: {
      ...preset.theme?.extend,
      // Add your custom theme extensions
    },
  },
} satisfies Config;

export default config;
```

Make sure to import the preset Tailwind styles in your main CSS file:

```css
@import '@sqlrooms/ui/tailwind-preset.css';
```

### Setting Up the Room Store

1. First, define your panel types and room configuration:

```typescript
import {BaseRoomConfig, LayoutTypes, MAIN_VIEW} from '@sqlrooms/room-config';
import {z} from 'zod';

// Define panel types
export const RoomPanelTypes = z.enum([
  'room-details',
  'data-sources',
  MAIN_VIEW,
] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

// Define your room config
// This holds all state necessary for persisting/saving the state of the app
export const RoomConfig = BaseRoomConfig;
// If using additional slices like SQL Editor:
// export const RoomConfig = BaseRoomConfig.merge(SqlEditorSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

// Define your application state type
export type RoomState = RoomState<RoomConfig>;
// If using additional slices:
// export type RoomState = RoomState<RoomConfig> & SqlEditorSliceState;
```

2. Create your room store:

```typescript
import {createRoomSlice, createRoomStore} from '@sqlrooms/room-shell';
import {DatabaseIcon} from 'lucide-react';

export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    // Base room slice
    ...createRoomSlice<RoomConfig>({
      // config holds all state that should be persisted between sessions
      config: {
        title: 'My SQLRooms Room',
        layout: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'row',
            first: RoomPanelTypes.enum['data-sources'],
            second: MAIN_VIEW,
            splitPercentage: 30,
          },
        },
        dataSources: [],
      },
      room: {
        panels: {
          'data-sources': {
            title: 'Data Sources',
            icon: DatabaseIcon,
            component: DataSourcesPanel,
            placement: 'sidebar',
          },
          [MAIN_VIEW]: {
            title: 'Main View',
            icon: () => null,
            component: MainView,
            placement: 'main',
          },
        },
      },
    })(set, get, store),

    // Add additional slices if needed
    // ...createSqlEditorSlice()(set, get, store),
  }),
);
```

3. Optionally add persistence:

```typescript
import {persist} from 'zustand/middleware';

// The config is meant to be saved for persistence between sessions
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  persist(
    (set, get, store) => ({
      // Store configuration as shown above
      ...createRoomSlice<RoomConfig>({
        config: {
          title: 'My SQLRooms Room',
          // ...other configuration
        },
        room: {
          panels: {
            // Panel definitions
          },
        },
      })(set, get, store),
    }),
    {
      name: 'app-state-storage',
      // Specify which parts of the state to persist
      partialize: (state) => ({
        // Persist configuration between sessions
        config: state.config,
        // Add other state properties you want to persist
      }),
    },
  ),
);
```

### Using the Room Store

Wrap your application with a `RoomShell` which provides the room store context:

```typescript
import {RoomShell} from '@sqlrooms/room-shell';
import {roomStore} from './store';

function App() {
  return (
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.Sidebar/>
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
    </RoomShell>
  );
}
```

Access the store in your components:

```typescript
function YourComponent() {
  // Config is now accessed directly from state, not from state.room.config
  const roomConfig = useRoomStore((state) => state.config);
  // Other state properties remain in the room object
  const dataSources = useRoomStore((state) => state.room.dataSources);

  return (
    // Your component JSX
  );
}
```

## Key Features

- DuckDB integration for powerful data analytics
- Customizable panel system with sidebar and main view layouts
- Built-in data source management
- Extensible room configuration with Zod schemas
- Type-safe state management

## Need Help?

- Check our [documentation](https://github.com/sqlrooms/sqlrooms)
- File an issue on [GitHub](https://github.com/sqlrooms/sqlrooms/issues)

<!-- END:getting-started.md -->

# Development

## Develop locally

    pnpm install
    pnpm build
    pnpm dev

## Devel documentation locally

The documentation is built using [VitePress](https://vitepress.dev/) and [TypeDoc](https://typedoc.org/). To develop the documentation locally:

1. Install dependencies:

   ```bash
   pnpm install
   pnpm build
   pnpm docs:dev
   ```

   This will start a local server with hot-reloading at http://localhost:5173

2. Build the documentation:

   ```bash
   pnpm docs:build
   ```

3. Preview the built documentation:
   ```bash
   pnpm docs:preview
   ```
   This will serve the built documentation at http://localhost:4173

The documentation source files are located in the `docs/` directory. API documentation is automatically generated from TypeScript source code using TypeDoc.

## Working with media files (Git LFS)

This project uses Git Large File Storage (LFS) for managing media files in the documentation. To work with these files:

1. Install Git LFS on your system:

   ```bash
   # macOS (using Homebrew)
   brew install git-lfs

   # Ubuntu/Debian
   sudo apt install git-lfs
   ```

2. Initialize Git LFS in your local repository:

   ```bash
   git lfs install
   ```

3. Pull existing LFS files:

   ```bash
   git lfs pull
   ```

4. When adding new media files to the `docs/media/` directory, they will be automatically tracked by Git LFS as specified in the `.gitattributes` file.
