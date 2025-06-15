---
outline: deep
---

# Getting Started with SQLRooms

SQLRooms is a powerful framework and a set of building blocks for creating DuckDB-backed analytics applications in React. This guide will help you integrate SQLRooms into your application. For a detailed overview of the framework's architecture, check out the [Overview](/overview) page.

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
