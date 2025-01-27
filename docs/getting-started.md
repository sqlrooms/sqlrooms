---
outline: deep
---

# Getting Started with SQLRooms

SQLRooms is a powerful framework and a set of building blocks for creating DuckDB-backed analytics applications in React. This guide will help you integrate SQLRooms into your application. For a detailed overview of the framework's architecture, check out the [Overview](/overview) page.

## Prerequisites

Your application should have the following dependencies:

- React 18 or higher
- Tailwind CSS
- [Zustand](https://zustand.docs.pmnd.rs) for state management
- [Zod](https://zod.dev) for schema val idation
- Node.js >= 20

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
    '../../packages/*/src/**/*.{ts,tsx}',
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

@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Setting Up the Project Store

1. First, define your project configuration by extending the BaseProjectConfig schema:

```typescript
import {BaseProjectConfig, MAIN_VIEW} from '@sqlrooms/project-config';
import {z} from 'zod';

// Define panel types
export const ProjectPanelTypes = z.enum([
  // Your project panels
  'project-details',
  'data-sources',
  // Main view should always be added
  MAIN_VIEW,
] as const);

// Extend the base config with your custom fields
export const YourProjectConfig = BaseProjectConfig.extend({
  // Add more custom fields here
});

// Generate the TypeScript type from the Zod schema
export type YourProjectConfig = z.infer<typeof YourProjectConfig>;
```

2. Create a project store that extends the base project store:

```typescript
import {
  createProjectSlice,
  ProjectState,
  useBaseProjectStore,
} from '@sqlrooms/project-builder';
import {createStore} from 'zustand';

export type YourProjectState = ProjectState<YourProjectConfig> & {
  // Add your custom state properties and methods here
};

export const createProjectStore = () =>
  createStore<YourProjectState>()((set, get, store) => {
    const baseProjectStore = createProjectSlice<YourProjectConfig>(
      INITIAL_PROJECT_STATE,
    )(set, get, store);

    return {
      ...baseProjectStore,
      // Add your custom methods here
    };
  });

export function useProjectStore<T>(
  selector: (state: YourProjectState) => T,
): T {
  return useBaseProjectStore(
    selector as (state: ProjectState<YourProjectConfig>) => T,
  );
}
```

3. Define your initial project state:

```typescript
import { INITIAL_BASE_PROJECT_CONFIG, INITIAL_BASE_PROJECT_STATE, ProjectPanelInfo } from '@sqlrooms/project-builder';
import { MAIN_VIEW } from '@sqlrooms/project-config';

// Configure your panels
export const PROJECT_PANELS: Partial<Record<z.infer<typeof ProjectPanelTypes>, ProjectPanelInfo>> = {
  'project-details': {
    title: 'Project Details',
    icon: InfoIcon,
    component: () => <YourProjectDetailsPanel />,
    placement: 'sidebar',
  },
  'data-sources': {
    title: 'Data Sources',
    icon: DatabaseIcon,
    component: () => <YourDataSourcesPanel />,
    placement: 'sidebar',
  },
  [MAIN_VIEW]: {
    title: 'Main View',
    icon: MapIcon,
    component: () => <YourMainView />,
    placement: 'main',
  },
};

export const INITIAL_PROJECT_STATE = {
  ...INITIAL_BASE_PROJECT_STATE,
  initialized: true,
  projectConfig: {
    ...INITIAL_BASE_PROJECT_CONFIG,
    dataSources: [],
    analysisResults: [], // Initialize your custom fields
  },
  projectPanels: PROJECT_PANELS,
};
```

## Using the Project Store

Wrap your application with the project store provider:

```typescript
import { ProjectBuilderProvider } from '@sqlrooms/project-builder';

function App() {
  return (
    <ProjectBuilderProvider createStore={createProjectStore}>
      <YourApp />
    </ProjectBuilderProvider>
  );
}
```

Access the store in your components:

```typescript
function YourComponent() {
  const projectConfig = useProjectStore((state) => state.projectConfig);
  const analysisResults = useProjectStore((state) => state.projectConfig.analysisResults);

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
