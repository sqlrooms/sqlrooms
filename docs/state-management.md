# State Management

SQLRooms uses a slice-based architecture powered by [Zustand](http://zustand.docs.pmnd.rs/) for state management. This approach allows you to compose different functionality slices into a unified application state.

## Why Zustand?

[Zustand](https://zustand.docs.pmnd.rs/) is a small, fast, and scalable state management solution for React applications. SQLRooms chose Zustand for several key reasons:

- **Simplicity**: Zustand has a minimal API that's easy to learn and use, with no boilerplate code.
- **Performance**: It uses the React concurrent renderer and only re-renders components when their specific slice of state changes.
- **Flexibility**: Zustand works well with TypeScript, supports middleware, and can be used outside of React components.
- **Composability**: The slices pattern allows for modular state management that scales with application complexity.

Unlike other state management libraries, Zustand doesn't require providers or context wrappers, making it lightweight and straightforward to integrate into any component.

## Understanding Slices

A [slice](https://zustand.docs.pmnd.rs/guides/slices-pattern) is a modular piece of state and associated actions that can be combined with other slices to form a complete application state. Feature packages which manage their own state typically provide a slice that can be integrated into your application store.

### How to Combine Slices

Slices are combined in the store creation process. Here's an example from the AI example application:

```typescript
import {AiSliceState} from '@sqlrooms/ai';
import {RoomShellSliceState} from '@sqlrooms/room-shell';
import {SqlEditorSliceState} from '@sqlrooms/sql-editor';

// Combining multiple slices into a unified application state type
export type RoomState = RoomShellSliceState<RoomConfig> &
  AiSliceState &
  SqlEditorSliceState &
  CustomRoomState;

// Creating a store with multiple slices
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    // Base room state
    ...createRoomShellSlice<RoomConfig>({
      // Room configuration
      // ...
    })(set, get, store),

    // SQL editor slice
    ...createSqlEditorSlice()(set, get, store),

    // AI slice with custom configuration
    ...createAiSlice({
      // AI slice configuration
    })(set, get, store),

    // Custom application state
    // ...
  }),
);
```

This approach allows you to:

1. Include only the slices you need
2. Customize each slice with your own configuration
3. Extend slices with additional functionality
4. Create custom slices for application-specific features

### How to Access Store Data

Once you've combined slices into a unified store, you can access different parts of the store using selectors. Here's an example:

```typescript
// Import the store hook (returned from `createRoomStore`)
import {useRoomStore} from '../store';

export const MyCustomView: React.FC = () => {
  // Access room slice data
  const isDataAvailable = useRoomStore((state) => state.room.isDataAvailable);

  // Access AI slice config (persistable state)
  const currentSessionId = useRoomStore((s) => s.config.ai.currentSessionId);

  // Access custom app state
  const apiKey = useRoomStore((s) => s.apiKey);
  // Access actions from custom app state
  const setApiKey = useRoomStore((s) => s.setApiKey);

  // Rest of component...
};
```

Each selector function receives the entire store state and returns only the specific piece of data needed, which helps optimize rendering performance by preventing unnecessary re-renders.

### Defining Configuration Types with Zod

SQLRooms uses [Zod](https://zod.dev/) for runtime type validation. When combining slices, you'll often need to combine their configuration types as well. The `.merge` method from Zod makes this process straightforward.

Here's an example from the AI example application showing how to combine configuration types:

```typescript
import {AiSliceConfig} from '@sqlrooms/ai';
import {BaseRoomConfig} from '@sqlrooms/room-config';
import {SqlEditorSliceConfig} from '@sqlrooms/sql-editor';
import {z} from 'zod';

/**
 * Room config for saving - combining multiple slice configs
 */
export const RoomConfig = BaseRoomConfig.merge(AiSliceConfig)
  .merge(SqlEditorSliceConfig)
  .merge(
    z.object({
      // Custom app config
    }),
  );
export type RoomConfig = z.infer<typeof RoomConfig>;
```

This approach offers several benefits:

1. **Type Safety**: The combined type is fully type-safe, with TypeScript inferring the correct type from the Zod schema.
2. **Runtime Validation**: The schema can validate data at runtime, ensuring configuration objects match the expected structure.
3. **Modularity**: Each slice provides its own configuration schema that can be combined with others.
4. **Documentation**: The schema serves as self-documenting code, clearly showing what configuration options are available.

When using the combined configuration type in your store, you can ensure that all required configuration properties from each slice are properly included:

```typescript
// Using the combined RoomConfig in the store
...createRoomSlice<RoomConfig>({
  config: {
    // AI slice configuration
    ...createDefaultAiConfig(),
    // SQL Editor slice configuration
    ...createDefaultSqlEditorConfig(),
    // Other configuration properties...
  },
  // Rest of room configuration...
})(set, get, store)
```

This pattern ensures that your application's configuration is both type-safe at compile time and validated at runtime.
