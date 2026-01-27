---
outline: deep
---

# Getting Started with SQLRooms

SQLRooms is a powerful framework and a set of building blocks for creating DuckDB-backed analytics applications in React. This guide will help you integrate SQLRooms into your application. For a detailed overview of the framework's architecture and core ideas, check out the [Key Concepts](/key-concepts) and [Modular Architecture](/modular-architecture) pages.

## Try the Minimal Example

The [Minimal Example](https://github.com/sqlrooms/examples/tree/main/minimal) is the quickest way to see SQLRooms in action with the smallest possible setup. It demonstrates loading a CSV data source and running SQL queries with `useSql()` in a barebones Vite + React app.

To create a new project from the minimal example, run:

```bash
npx giget gh:sqlrooms/examples/minimal my-minimal-app/
cd my-minimal-app
npm install
npm run dev
```

---

## Try the Get Started Example

The [Get Started Example](https://github.com/sqlrooms/examples/tree/main/get-started) is a more feature-rich starter template that demonstrates a typical SQLRooms application structure, including panels, layout, and configuration.

To create a new project from the get-started example, run:

```bash
npx giget gh:sqlrooms/examples/get-started myapp/
cd myapp
npm install
npm run dev
```

This Vite application demonstrates loading a CSV data source and running SQL queries with `useSql()`, along with a more complete app shell and layout.

## Manual Setup

### Prerequisites

Your application should have the following dependencies:

- [React 18+](https://react.dev/) (React 19 is supported)
- [Tailwind CSS](https://tailwindcss.com/)
- [Node.js](https://nodejs.org/) >= 22

SQLRooms uses [Zustand](https://zustand.docs.pmnd.rs) for state management and [Zod](https://zod.dev) for schema validation internally, but you don't need to install them separately

### Installation

Install the required SQLRooms packages:

::: code-group

```bash [npm]
npm install @sqlrooms/room-shell @sqlrooms/duckdb @sqlrooms/ui
```

```bash [pnpm]
pnpm add @sqlrooms/room-shell @sqlrooms/duckdb @sqlrooms/ui
```

```bash [yarn]
yarn add @sqlrooms/room-shell @sqlrooms/duckdb @sqlrooms/ui
```

:::

### Configure Tailwind CSS

You can follow [this guide](https://tailwindcss.com/docs/installation/using-vite) to install and configure Tailwind 4.

::: code-group

```bash [npm]
npm install -D tailwindcss@4
```

```bash [pnpm]
pnpm add -D tailwindcss@4
```

```bash [yarn]
yarn add -D tailwindcss@4
```

:::

SQLRooms provides a Tailwind preset that includes all the necessary styles. Make sure to import the preset Tailwind styles in your main CSS file:

```css
@import '@sqlrooms/ui/tailwind-preset.css';
```

### Setting Up the Room Store

1. Define your application state type:

```typescript
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';

/**
 * The whole app state.
 */
export type RoomState = RoomShellSliceState & {
  // Add your custom app state types here
  // If using additional slices:
  // & SqlEditorSliceState
};
```

2. Create your room store:

```typescript
import {LayoutTypes} from '@sqlrooms/room-shell';
import {DatabaseIcon} from 'lucide-react';
import {MainView} from './components/MainView';
import {DataSourcesPanel} from './components/DataSourcesPanel';

/**
 * Create the room store. You can combine your custom state and logic
 * with the slices from the SQLRooms modules.
 */
export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      config: {
        title: 'My SQLRooms App',
        dataSources: [
          {
            tableName: 'earthquakes',
            type: 'url',
            url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
          },
        ],
      },
      layout: {
        config: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'row',
            first: 'data-sources',
            second: 'main',
            splitPercentage: 30,
          },
        },
        panels: {
          'data-sources': {
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

    // Add additional slices if needed
    // ...createSqlEditorSlice()(set, get, store),
  }),
);
```

3. Optionally add persistence using the `persistSliceConfigs` helper:

```typescript
import {
  BaseRoomConfig,
  LayoutConfig,
  persistSliceConfigs,
} from '@sqlrooms/room-shell';

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  persistSliceConfigs(
    {
      name: 'app-state-storage',
      sliceConfigSchemas: {
        room: BaseRoomConfig,
        layout: LayoutConfig,
        // Add other slice configs as needed
        // sqlEditor: SqlEditorSliceConfig,
      },
    },
    (set, get, store) => ({
      // Store configuration as shown above
      ...createRoomShellSlice({
        config: {
          title: 'My SQLRooms App',
          dataSources: [],
        },
        layout: {
          config: {
            type: LayoutTypes.enum.mosaic,
            nodes: {
              // layout configuration
            },
          },
          panels: {
            // Panel definitions
          },
        },
      })(set, get, store),
    }),
  ),
);
```

### Using the Room Store

Wrap your application with a `RoomShell` which provides the room store context:

```typescript
import {RoomShell} from '@sqlrooms/room-shell';
import {ThemeProvider} from '@sqlrooms/ui';
import {roomStore} from './store';

export const Room = () => (
  <ThemeProvider defaultTheme="light" storageKey="sqlrooms-ui-theme">
    <RoomShell className="h-screen" roomStore={roomStore}>
      <RoomShell.Sidebar />
      <RoomShell.LayoutComposer />
      <RoomShell.LoadingProgress />
    </RoomShell>
  </ThemeProvider>
);
```

Access the store in your components:

```typescript
import {useRoomStore} from './store';

function YourComponent() {
  // Access config from room
  const roomConfig = useRoomStore((state) => state.room.config);

  // Access database state
  const tables = useRoomStore((state) => state.db.tables);

  // Check if a table is ready
  const tableReady = useRoomStore((state) =>
    state.db.findTableByName('earthquakes'),
  );

  return (
    // Your component JSX
  );
}
```

### Querying Data

Use the `useSql` hook from `@sqlrooms/duckdb` to run SQL queries:

```typescript
import {useSql} from '@sqlrooms/duckdb';
import {useRoomStore} from './store';

function MainView() {
  const tableReady = useRoomStore((state) =>
    state.db.findTableByName('earthquakes'),
  );

  const {data, isLoading, error} = useSql<{
    count: number;
    maxMag: number;
  }>({
    query: `
      SELECT
        COUNT(*)::int AS count,
        max(Magnitude) AS maxMag
      FROM earthquakes
    `,
    enabled: Boolean(tableReady),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const row = data?.toArray()[0];
  return (
    <div>
      <div>Total records: {row?.count}</div>
      <div>Max magnitude: {row?.maxMag}</div>
    </div>
  );
}
```

The `useSql` hook automatically re-runs queries when the database state changes and provides loading/error states out of the box.

## Need Help?

- Start or join a discussion on [GitHub Discussions](https://github.com/sqlrooms/sqlrooms/discussions)
- File an issue on [GitHub](https://github.com/sqlrooms/sqlrooms/issues)
