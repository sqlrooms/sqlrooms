A central configuration and type definitions package that maintains base room configuration schemas and Zod schema definitions. It provides TypeScript types and interfaces along with essential constants and utilities used throughout the framework.

## Features

- 📝 **Room Configuration**: Define and manage room configuration schemas
- 🔍 **Type Safety**: Strong TypeScript typing for configuration objects
- ✅ **Validation**: Zod schemas for runtime validation of configuration

## Installation

```bash
npm install @sqlrooms/room-config
# or
yarn add @sqlrooms/room-config
```

## Basic Usage

### Working with Base Room Configuration

```tsx
import {BaseRoomConfig} from '@sqlrooms/room-config';

// Create a new room configuration
const roomConfig: BaseRoomConfig = {
  name: 'My SQL Room',
  description: 'A data analysis room using SQLRooms',
  version: '1.0.0',
  settings: {
    theme: 'dark',
    // Other settings...
  },
};

// Access configuration properties
console.log(roomConfig.name); // 'My SQL Room'
```

### Persisting Room Configuration

Room configuration is designed to be saved and restored between sessions. Here's how to use it with Zustand's persist middleware:

```tsx
import {persist} from 'zustand/middleware';
import {
  createRoomStore,
  createRoomShellSlice,
  RoomShellSliceState,
  StateCreator,
  createPersistHelpers,
  LayoutConfig,
} from '@sqlrooms/room-shell';
import {BaseRoomConfig} from '@sqlrooms/room-config';

type MyRoomState = RoomShellSliceState;

// Create a store with persistence for configuration
const {useRoomStore} = createRoomStore<MyRoomState>(
  persist(
    (set, get, store) => ({
      ...createRoomShellSlice({
        config: {
          title: 'My Room',
          // Other configuration properties
        },
        layout: {
          config: {
            // Layout configuration
          },
          panels: {
            // Panel definitions
          },
        },
      })(set, get, store),
    }),
    {
      name: 'room-config-storage',
      // Use helper to persist configuration
      ...createPersistHelpers({
        room: BaseRoomConfig,
        layout: LayoutConfig,
      }),
    },
  ) as StateCreator<MyRoomState>,
);

// Access the config in components
function ConfigComponent() {
  // Config is accessed from state.room.config
  const config = useRoomStore((state) => state.room.config);

  return <div>{config.title}</div>;
}
```

## Advanced Features

- **Schema Extensions**: Extend base schemas for custom room types
- **Configuration Validation**: Validate configurations at runtime
- **Serialization**: Convert configurations to/from JSON for storage

For more information, visit the SQLRooms documentation.

```

```
