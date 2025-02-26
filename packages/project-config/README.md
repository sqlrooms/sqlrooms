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
import {BaseProjectConfig} from '@sqlrooms/project-config';

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

### Using Layout Configuration

```tsx
import {LayoutConfig} from '@sqlrooms/project-config';

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
