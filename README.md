# <img src=https://github.com/user-attachments/assets/dd6b2929-29f5-4c8b-a0c0-51ec84603e6b width=23> SQLRooms

Building blocks for React data analytics applications powered by [DuckDB](https://duckdb.org/docs/api/wasm/overview.html)

[Documentation](https://sqlrooms.org/) | [Examples](https://sqlrooms.org/examples.html)

<!-- INCLUDE:overview.md -->

# Overview

SQLRooms provides a comprehensive foundation and rich set of building blocks for creating modern, interactive data-analytics applications that can run entirely in the browser.
At its core is the concept of a **_Room_** — a self‑contained workspace where data lives, analysis happens, and (soon) collaborators meet. It combines essential components like a SQL query engine (DuckDB), data visualization tools, state management, and UI components into a cohesive toolkit, making it significantly easier to create powerful analytics tools with or without a backend.

![SQLRooms example apps](docs/media/overview/collage.webp)

## Why SQLRooms?

SQLRooms is designed to empower developers and users with a modern, modular analytics toolkit that runs entirely in the browser. Here's what sets it apart:

- **Performance & Scale:** Every user gets a dedicated in-browser DuckDB instance, delivering columnar analytics speed with zero backend load.
- **Modular Architecture:** Mix and match packages, and combine state _slices_ to include only the features you need—no bloat, just what your app requires.
- **AI‑Powered Analytics:** Built-in support for agents that can write and execute SQL queries, and generate insights directly in your browser—no server roundtrips required.
- **Developer Experience:** A composable, React-based framework with ready-to-use components, state management, and visualization tools, making it easy to build custom analytics solutions.

## Why Single-Node?

SQLRooms is designed for single-node analytics: all computation happens on your device, whether in the browser or a desktop app (e.g. via [Electron](https://www.electronjs.org/)), with no backend required. Data can remain local if you choose, or be loaded from external sources like S3—always giving you full control over how and where your data is processed.

- **Privacy:** All data remains on your device for simplified compliance and peace of mind—nothing leaves your browser unless you choose.
- **Own Your Data:** You control your files and data, with no vendor lock-in or forced cloud storage. Your work is portable and future-proof.
- **Offline Use:** SQLRooms [supports offline work](http://sqlrooms.org/offline-use)—query, analyze, and visualize your data even without an internet connection.
- **Fast Local Querying:** Queries run instantly in your browser, with no network roundtrip or server lag—results are available as soon as you ask.
- **Private AI Insights:** AI agents generate insights and run queries locally, so your data is never shared with external model providers. You get the power of AI-driven analytics without sacrificing privacy.

## Local-First Foundations

This approach draws on [Local-First principles](https://www.inkandswitch.com/essay/local-first), which emphasize user ownership and seamless collaboration. In Local-First apps, users retain full control of their data — it lives on their device, remains accessible offline, and isn’t locked behind a remote server. By contrast, traditional cloud apps centralize both computation and storage, often reducing user agency. If the service goes down or is discontinued, the app may stop working entirely, and user data can become inaccessible.

While SQLRooms does not yet implement sync or collaboration, it is already capable of delivering some of the key benefits of local-first software — your data and computation can stay private and accessible on your device.

## Next Steps

- **Review the [Key Concepts](http://sqlrooms.org/key-concepts)** to understand the core ideas and architecture.

- **Explore the [Modular Architecture](http://sqlrooms.org/modular-architecture)** to see how you can compose and extend your app.

- **Check the [Example Applications](http://sqlrooms.org/examples)** to see what can be built with the framework.

<!-- - **Quick start the [Getting Started Guide](http://sqlrooms.org/getting-started)** to set up your first room.

- **Read the [API reference](http://sqlrooms.org/packages/)** for deeper integration. -->

<!-- END:overview.md -->

<!-- INCLUDE:getting-started.md -->

# Getting Started with SQLRooms

SQLRooms is a powerful framework and a set of building blocks for creating DuckDB-backed analytics applications in React. This guide will help you integrate SQLRooms into your application. For a detailed overview of the framework's architecture and core ideas, check out the [Key Concepts](http://sqlrooms.org/key-concepts) and [Modular Architecture](http://sqlrooms.org/modular-architecture) pages.

## Try the Minimal Example

The [Minimal Example](https://github.com/sqlrooms/examples/tree/main/minimal) is the quickest way to see SQLRooms in action with the smallest possible setup. It demonstrates loading a CSV data source and running SQL queries with `useSql()` in a barebones Vite + React app.

To create a new project from the minimal example, run:

```bash
npx degit sqlrooms/examples/minimal my-minimal-app/
cd my-minimal-app
npm install
npm run dev
```

---

## Try the Get Started Example

The [Get Started Example](https://github.com/sqlrooms/examples/tree/main/get-started) is a more feature-rich starter template that demonstrates a typical SQLRooms application structure, including panels, layout, and configuration.

To create a new project from the get-started example, run:

```bash
npx degit sqlrooms/examples/get-started myapp/
cd myapp
npm install
npm run dev
```

This Vite application demonstrates loading a CSV data source and running SQL queries with `useSql()`, along with a more complete app shell and layout.

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
npm install @sqlrooms/room-shell @sqlrooms/room-store @sqlrooms/ui
```

```bash [pnpm]
pnpm add @sqlrooms/room-shell @sqlrooms/room-store @sqlrooms/ui
```

```bash [yarn]
yarn add @sqlrooms/room-shell @sqlrooms/room-store @sqlrooms/ui
```

:::

### Configure Tailwind CSS

You can follow [this guide](https://v3.tailwindcss.com/docs/installation) to install and configure Tailwind 3 (Tailwind 4 support is still experimental).

::: code-group

```bash [npm]
npm install -D tailwindcss@3
npx tailwindcss init
```

```bash [pnpm]
pnpm add -D tailwindcss@3
npx tailwindcss init
```

```bash [yarn]
yarn add -D tailwindcss@3
npx tailwindcss init
```

:::

SQLRooms provides a Tailwind preset that includes all the necessary styles. Update your `tailwind.config.js` or `tailwind.config.ts`:

```typescript
import {sqlroomsTailwindPreset} from '@sqlrooms/ui';
import type {Config} from 'tailwindcss';

const config = {
  presets: [sqlroomsTailwindPreset()],
  content: [
    // Your content paths...
    './src/**/*.{ts,tsx}',
    // Add SQLRooms packages to content paths
    './node_modules/@sqlrooms/**/dist/**/*.js',
  ],
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
import {BaseRoomConfig, LayoutTypes, MAIN_VIEW} from '@sqlrooms/room-store';
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
import {createRoomShellSlice, createRoomStore} from '@sqlrooms/room-shell';
import {DatabaseIcon} from 'lucide-react';

export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    // Base room slice
    ...createRoomShellSlice<RoomConfig>({
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
      ...createRoomShellSlice<RoomConfig>({
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

## Need Help?

- Start or join a discussion on [GitHub Discussions](https://github.com/sqlrooms/sqlrooms/discussions)
- File an issue on [GitHub](https://github.com/sqlrooms/sqlrooms/issues)

<!-- END:getting-started.md -->

# Development

## Develop locally

    pnpm install
    pnpm build
    pnpm dev

## Develop documentation locally

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
