A central configuration and type definitions package that maintains base project configuration schemas and Zod schema definitions. It provides TypeScript types and interfaces along with essential constants and utilities used throughout the framework.

## Features

- 📝 **Project Configuration**: Define and manage project configuration schemas
- 🔍 **Type Safety**: Strong TypeScript typing for configuration objects
- 🧩 **Layout Configuration**: Flexible layout configuration system
- ✅ **Validation**: Zod schemas for runtime validation of configuration

## Installation

```bash
npm install @sqlrooms/project-config
# or
yarn add @sqlrooms/project-config
```

## Basic Usage

### Working with Base Project Configuration

```tsx
import {BaseProjectConfig} from '@sqlrooms/project';

// Create a new project configuration
const projectConfig: BaseProjectConfig = {
  name: 'My SQL Project',
  description: 'A data analysis project using SQLRooms',
  version: '1.0.0',
  settings: {
    theme: 'dark',
    // Other settings...
  },
};

// Access configuration properties
console.log(projectConfig.name); // 'My SQL Project'
```

### Persisting Project Configuration

Project configuration is designed to be saved and restored between sessions. Here's how to use it with Zustand's persist middleware:

```tsx
import {persist} from 'zustand/middleware';
import {
  createProjectStore,
  createProjectSlice,
} from '@sqlrooms/project-builder';
import {BaseProjectConfig} from '@sqlrooms/project';

// Create a store with persistence for configuration
const {useProjectStore} = createProjectStore(
  persist(
    (set, get, store) => ({
      ...createProjectSlice({
        // Config is stored at the root level of state for persisting the app state
        config: {
          title: 'My Project',
          // Other configuration properties
        },
        // Project object contains panels and runtime-only state
        project: {
          panels: {
            // Panel definitions
          },
        },
      })(set, get, store),
    }),
    {
      name: 'project-config-storage',
      // Only persist the configuration part of the state
      partialize: (state) => ({
        config: state.config,
      }),
    },
  ),
);

// Access the config in components
function ConfigComponent() {
  // Config is accessed directly from state, not from state.project.config
  const config = useProjectStore((state) => state.config);

  return <div>{config.title}</div>;
}
```

### Using Layout Configuration

```tsx
import {LayoutConfig} from '@sqlrooms/project';

// Define a layout configuration
const layoutConfig: LayoutConfig = {
  layout: 'grid',
  panels: [
    {
      id: 'editor',
      type: 'sql-editor',
      position: {x: 0, y: 0, width: 6, height: 4},
    },
    {
      id: 'results',
      type: 'data-table',
      position: {x: 0, y: 4, width: 6, height: 4},
    },
  ],
};

// Use the layout configuration in your application
function renderLayout(config: LayoutConfig) {
  // Implementation...
}
```

## Advanced Features

- **Schema Extensions**: Extend base schemas for custom project types
- **Configuration Validation**: Validate configurations at runtime
- **Serialization**: Convert configurations to/from JSON for storage

For more information, visit the SQLRooms documentation.

```

```
