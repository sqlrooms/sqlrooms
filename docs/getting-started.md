---
outline: deep
---

# Getting Started with SQLRooms

SQLRooms is a powerful framework and a set of building blocks for creating DuckDB-backed analytics applications in React. This guide will help you integrate SQLRooms into your application. For a detailed overview of the framework's architecture, check out the [Overview](/overview) page.

## Prerequisites

Your application should have the following dependencies:

- [React 18](https://react.dev/) or higher
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://zustand.docs.pmnd.rs) for state management
- [Zod](https://zod.dev) for schema validation
- [Node.js](https://nodejs.org/) >= 20

## Installation

Install the required SQLRooms packages:

::: code-group

```bash [npm]
npm install @sqlrooms/project-builder @sqlrooms/project-config @sqlrooms/layout @sqlrooms/ui
```

```bash [pnpm]
pnpm add @sqlrooms/project-builder @sqlrooms/project-config @sqlrooms/layout @sqlrooms/ui
```

```bash [yarn]
yarn add @sqlrooms/project-builder @sqlrooms/project-config @sqlrooms/layout @sqlrooms/ui
```

:::

## Configure Tailwind CSS

SQLRooms provides a Tailwind preset that includes all the necessary styles. Update your `tailwind.config.js` or `tailwind.config.ts`:

```typescript
import {sqlroomsTailwindPreset} from '@sqlrooms/ui';
import type {Config} from 'tailwindcss';

const preset = sqlroomsTailwindPreset({prefix: ''});
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

## Setting Up the Project Store

1. First, define your panel types and project configuration:

```typescript
import {
  BaseProjectConfig,
  LayoutTypes,
  MAIN_VIEW,
} from '@sqlrooms/project-config';
import {z} from 'zod';

// Define panel types
export const ProjectPanelTypes = z.enum([
  'project-details',
  'data-sources',
  MAIN_VIEW,
] as const);
export type ProjectPanelTypes = z.infer<typeof ProjectPanelTypes>;

// Define your project config
// This holds all state necessary for persisting/saving the state of the app
export const AppConfig = BaseProjectConfig;
// If using additional slices like SQL Editor:
// export const AppConfig = BaseProjectConfig.merge(SqlEditorSliceConfig);
export type AppConfig = z.infer<typeof AppConfig>;

// Define your application state type
export type AppState = ProjectState<AppConfig>;
// If using additional slices:
// export type AppState = ProjectState<AppConfig> & SqlEditorSliceState;
```

2. Create your project store:

```typescript
import {
  createProjectSlice,
  createProjectStore,
} from '@sqlrooms/project-builder';
import {DatabaseIcon} from 'lucide-react';

export const {projectStore, useProjectStore} = createProjectStore<
  AppConfig,
  AppState
>((set, get, store) => ({
  // Base project slice
  ...createProjectSlice<AppConfig>({
    // config holds all state that should be persisted between sessions
    config: {
      title: 'My SQLRooms Project',
      layout: {
        type: LayoutTypes.enum.mosaic,
        nodes: {
          direction: 'row',
          first: ProjectPanelTypes.enum['data-sources'],
          second: MAIN_VIEW,
          splitPercentage: 30,
        },
      },
      dataSources: [],
    },
    project: {
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
}));
```

3. Optionally add persistence:

```typescript
import {persist} from 'zustand/middleware';

// The config is meant to be saved for persistence between sessions
export const {projectStore, useProjectStore} = createProjectStore<
  AppConfig,
  AppState
>(
  persist(
    (set, get, store) => ({
      // Store configuration as shown above
      ...createProjectSlice<AppConfig>({
        config: {
          title: 'My SQLRooms Project',
          // ...other configuration
        },
        project: {
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

## Using the Project Store

Wrap your application with the project store provider:

```typescript
import {ProjectBuilderProvider} from '@sqlrooms/project-builder';

function App() {
  return (
    <ProjectBuilderProvider store={projectStore}>
      <YourApp />
    </ProjectBuilderProvider>
  );
}
```

Access the store in your components:

```typescript
function YourComponent() {
  // Config is now accessed directly from state, not from state.project.config
  const projectConfig = useProjectStore((state) => state.config);
  // Other state properties remain in the project object
  const dataSources = useProjectStore((state) => state.project.dataSources);

  return (
    // Your component JSX
  );
}
```

## Key Features

- DuckDB integration for powerful data analytics
- Customizable panel system with sidebar and main view layouts
- Built-in data source management
- Extensible project configuration with Zod schemas
- Type-safe state management

## Need Help?

- Check our [documentation](https://github.com/sqlrooms/sqlrooms)
- File an issue on [GitHub](https://github.com/sqlrooms/sqlrooms/issues)
