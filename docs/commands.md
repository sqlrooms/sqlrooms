# Commands

SQLRooms commands provide a typed, composable action layer for palette, AI, MCP, CLI, and API surfaces.

## Register commands

Commands are registered by owner and include metadata, input validation, and execution handlers.

```typescript
import {
  BaseRoomStoreState,
  CommandSliceState,
  createBaseRoomSlice,
  createCommandSlice,
  createRoomStore,
} from '@sqlrooms/room-store';
import {z} from 'zod';

type RoomState = BaseRoomStoreState & CommandSliceState;

const SetTitleInput = z.object({
  title: z.string().min(1),
});

export const {roomStore} = createRoomStore<RoomState>((set, get, store) => ({
  ...createBaseRoomSlice()(set, get, store),
  ...createCommandSlice()(set, get, store),
}));

roomStore.getState().commands.registerCommand('app', {
  id: 'app.set-title',
  name: 'Set title',
  description: 'Update the app title',
  inputSchema: SetTitleInput,
  ui: {
    keystrokes: ['Mod+Shift+T'],
  },
  execute: (_context, input) => {
    const {title} = input as z.infer<typeof SetTitleInput>;
    return {
      success: true,
      commandId: 'app.set-title',
      message: `Updated title to ${title}`,
    };
  },
});
```

### Keystrokes

- Add command keystrokes with `ui.keystrokes` (string or string array).
- Legacy `shortcut` values are still supported.
- Keystrokes are shown in `RoomShell.CommandPalette`.
- If `RoomShell.CommandPalette` is mounted, matching command keystrokes invoke commands directly.

## Command middleware

`createCommandSlice` accepts `createCommandProps`, including middleware.

Middleware signature:

```typescript
(command, input, context, next) => {
  // before
  const result = await next();
  // after
  return result;
};
```

Example middleware for feature flags:

```typescript
const featureFlagMiddleware = async (command, input, context, next) => {
  const enabled = context.getState().features.enabledCommands.includes(command.id);
  if (!enabled) {
    return {
      success: false,
      commandId: command.id,
      code: 'command-disabled-by-feature-flag',
      error: `Command "${command.name}" is disabled by feature flags.`,
    };
  }
  return await next();
};
```

## Telemetry callbacks via `createCommandProps`

You can instrument command execution without changing command implementations.

```typescript
const createCommandProps = {
  middleware: [featureFlagMiddleware],
  onCommandInvokeStart: ({command, context}) => {
    telemetry.track('command_start', {
      commandId: command.id,
      surface: context.invocation.surface,
    });
  },
  onCommandInvokeSuccess: ({command, durationMs}) => {
    telemetry.track('command_success', {
      commandId: command.id,
      durationMs,
    });
  },
  onCommandInvokeError: ({command, error}) => {
    telemetry.track('command_error', {
      commandId: command.id,
      message: String(error),
    });
  },
};
```

Use it directly with `createCommandSlice`:

```typescript
...createCommandSlice(createCommandProps)(set, get, store),
```

Or pass it through `createRoomShellSlice`:

```typescript
...createRoomShellSlice({
  config: {...},
  layout: {...},
  createCommandProps,
})(set, get, store),
```
