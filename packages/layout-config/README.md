A central configuration and type definitions package that maintains base layout configuration schemas and Zod schema definitions for SQLRooms. It provides TypeScript types and interfaces along with essential constants and utilities used for managing layouts.

## Features

- 📝 **Layout Configuration**: Define and manage room layout configuration schemas for Mosaic layouts
- 🔍 **Type Safety**: Strong TypeScript typing for layout configuration objects
- ✅ **Validation**: Zod schemas for runtime validation of layout configurations

## Installation

```bash
npm install @sqlrooms/layout-config
# or
yarn add @sqlrooms/layout-config
```

## Basic Usage

### Working with Mosaic Layout Configuration

```tsx
import {
  MosaicLayoutConfig,
  LayoutConfig,
  MAIN_VIEW,
} from '@sqlrooms/layout-config';

// Create a new room configuration
const layoutConfig: MosaicLayoutConfig = {
  type: 'mosaic',
  nodes: {
    direction: 'row',
    first: MAIN_VIEW,
    second: {
      direction: 'column',
      first: 'files',
      second: 'tables',
    },
  },
};

// This can be part of a bigger room configuration
interface RoomConfig {
  // ... other properties
  layout: LayoutConfig;
}
```

## Advanced Features

- **Schema Extensions**: Extend base schemas for custom room types
- **Configuration Validation**: Validate configurations at runtime
- **Serialization**: Convert configurations to/from JSON for storage

For more information, visit the SQLRooms documentation.

```

```
