---
outline: deep
---

# Commands

Commands are SQLRooms' typed action layer. They give the command palette, UI
controls, AI tools, CLI, MCP, and other API clients a shared vocabulary for
discovering and invoking workspace actions.

A command does not own application state. It validates an action, delegates to
the slice or feature that owns the state, and returns a structured result. The
registry and command definitions are runtime configuration; the owning feature
slice remains responsible for persistence.

## Decide what should be a command

Use a command for a stable, user-visible action that should be available from
more than one surface. Creating or renaming an artifact, adding a dashboard
panel, running a query, and appending document blocks are good examples.

Keep lower-level operations in their owning layer:

| Operation                                                | Prefer            |
| -------------------------------------------------------- | ----------------- |
| Durable product action shared by UI, AI, or integrations | Room command      |
| State mutation or invariant used internally by a feature | Slice method      |
| Model-only context lookup, planning, or summarization    | AI tool           |
| Multi-step generate, observe, and repair loop            | Specialized agent |

Commands should call existing slice methods instead of implementing a second
state model. AI tools that perform durable writes should invoke commands when a
matching command exists.

## Add the command registry

`createRoomShellSlice()` already includes the command registry and registers
the room shell's built-in commands during room initialization. Most SQLRooms
apps do not need to compose the registry separately.

When building a store directly from `@sqlrooms/room-store`, add
`createCommandSlice()` alongside the base slice:

```ts
import {
  createBaseRoomSlice,
  createCommandSlice,
  createRoomStore,
  type BaseRoomStoreState,
  type CommandSliceState,
} from '@sqlrooms/room-store';

interface RoomState extends BaseRoomStoreState, CommandSliceState<RoomState> {}

export const {roomStore} = createRoomStore<RoomState>((set, get, store) => ({
  ...createBaseRoomSlice()(set, get, store),
  ...createCommandSlice<RoomState>()(set, get, store),
}));
```

## Define a command family

Feature packages should expose factories that return `RoomCommand[]`. Keep IDs
stable and namespace them by feature, such as `report.rename` or
`block-document.append-blocks`.

```ts
import type {BaseRoomStoreState, RoomCommand} from '@sqlrooms/room-store';
import {z} from 'zod';

type ReportCommandState = BaseRoomStoreState & {
  reports: {
    getReport: (reportId: string) => {title: string} | undefined;
    renameReport: (reportId: string, title: string) => void;
  };
};

const RenameReportInput = z.object({
  reportId: z.string().describe('ID of the report to rename.'),
  title: z.string().trim().min(1).describe('New report title.'),
});

type RenameReportInput = z.infer<typeof RenameReportInput>;

export function createReportCommands<
  TRoomState extends ReportCommandState,
>(): RoomCommand<TRoomState>[] {
  return [
    {
      id: 'report.rename',
      name: 'Rename report',
      description: 'Change the title of a report.',
      group: 'Reports',
      keywords: ['report', 'title', 'rename'],
      inputSchema: RenameReportInput,
      inputDescription: 'Report ID and a non-empty title.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const {reportId, title} = input as RenameReportInput;
        const report = getState().reports.getReport(reportId);

        if (!report) {
          return {
            success: false,
            commandId: 'report.rename',
            code: 'report-not-found',
            error: `Unknown report "${reportId}".`,
          };
        }

        const previousTitle = report.title;
        getState().reports.renameReport(reportId, title);

        return {
          success: true,
          commandId: 'report.rename',
          message: `Renamed report to "${title}".`,
          data: {reportId, title, previousTitle},
        };
      },
    },
  ];
}
```

Zod parses the input before middleware or `execute()` runs. Use
`validateInput()` for checks that need current store state and use
`isEnabled()` or `isVisible()` when availability depends on the execution
context.

### Describe discovery, safety, and UI behavior

Command metadata is consumed by more than the palette:

| Field                                      | Purpose                                                          |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `name`, `description`, `group`, `keywords` | Human and intent-based discovery                                 |
| `inputSchema`, `inputDescription`          | Validation, palette input, and portable tool schemas             |
| `isVisible`, `isEnabled`                   | Context-sensitive discovery and availability                     |
| `metadata.readOnly`                        | Declares whether execution can change state                      |
| `metadata.idempotent`                      | Declares whether repeated calls have the same effect             |
| `metadata.riskLevel`                       | Classifies the consequence as `low`, `medium`, or `high`         |
| `metadata.requiresConfirmation`            | Requires an explicit confirmation on guarded surfaces            |
| `ui.keystrokes`                            | Adds one or more palette keyboard bindings                       |
| `ui.inputComponent`                        | Replaces the palette's generic JSON input UI                     |
| `ui.hidden`                                | Hides an internal command from the palette and default discovery |

Always set the policy metadata deliberately. The conservative defaults are
mutating, non-idempotent, medium risk, and no explicit confirmation flag. A
high-risk command is confirmation-gated by guarded invocation even when
`requiresConfirmation` is omitted.

Use descriptions on Zod fields. SQLRooms converts supported Zod schemas to a
portable JSON-schema representation for AI, CLI, and MCP discovery.

## Register and clean up commands

Register a complete command family under one owner:

```ts
import {
  registerCommandsForOwner,
  unregisterCommandsForOwner,
} from '@sqlrooms/room-store';

const REPORT_COMMAND_OWNER = '@acme/reports';

registerCommandsForOwner(
  roomStore,
  REPORT_COMMAND_OWNER,
  createReportCommands<RoomState>(),
);

// When the feature is removed or its slice is destroyed:
unregisterCommandsForOwner(roomStore, REPORT_COMMAND_OWNER);
```

Feature slices normally register commands in their `initialize()` lifecycle and
unregister them in `destroy()`. Calling `registerCommands()` for an existing
owner replaces that owner's previous command set, which makes re-registration
and hot reload deterministic. Pass the whole family each time; do not register
several commands one at a time with the same owner.

## Return useful results

Return a `RoomCommandResult` when callers need a meaningful outcome:

| Field       | Convention                                                         |
| ----------- | ------------------------------------------------------------------ |
| `success`   | Whether the requested outcome was achieved                         |
| `commandId` | Stable ID of the invoked command                                   |
| `message`   | Short summary for people, chat transcripts, and traces             |
| `code`      | Stable outcome for callers that need to branch                     |
| `data`      | IDs, chosen defaults, and other values needed by follow-up actions |
| `error`     | Concise explanation of an unsuccessful result                      |

An `execute()` handler may instead return data directly or return nothing;
SQLRooms normalizes either form into a successful result. Prefer an explicit
result for mutations so callers can identify what changed without rereading the
whole store.

## Add the command palette

Mount the palette once inside `RoomShell`. The optional compound button opens
the same palette and fits naturally in the shell sidebar:

```tsx
<RoomShell roomStore={roomStore}>
  <RoomShell.SidebarContainer>
    <RoomShell.TabButtons />
    <RoomShell.CommandPalette.Button />
  </RoomShell.SidebarContainer>

  <RoomShell.LayoutComposer />
  <RoomShell.CommandPalette />
</RoomShell>
```

Users can also open it with <kbd>Cmd</kbd>+<kbd>K</kbd> on macOS or
<kbd>Ctrl</kbd>+<kbd>K</kbd> elsewhere. A command with required input opens its
custom `ui.inputComponent` or the default JSON input editor. Commands without
required input run immediately. Define keyboard bindings with
`ui.keystrokes`, for example `Mod+Shift+R`; conflicting bindings are not
invoked directly.

## Invoke commands from application code

`invokeCommand()` returns unsuccessful outcomes as values. It is convenient
when the caller wants to display or inspect a failure:

```ts
const result = await roomStore.getState().commands.invokeCommand(
  'report.rename',
  {reportId: 'quarterly-sales', title: 'Q3 sales'},
  {
    surface: 'api',
    actor: 'report-settings-form',
    traceId: requestId,
    target: {kind: 'report', id: 'quarterly-sales'},
  },
);

if (!result.success) {
  showError(result.error);
}
```

`executeCommand()` uses the same path but throws when the normalized result is
unsuccessful. Use it where the surrounding control flow is already exception
based.

Invocation metadata is available to predicates, validation, middleware,
execution, and telemetry callbacks. `surface` can be `palette`, `ai`, `cli`,
`mcp`, `api`, or `unknown`. Handlers can also read `context.signal` and pass it
to cancellable work; cancellation is cooperative.

### Guard agent and external invocation

Direct `invokeCommand()` does not enforce confirmation metadata. Agent-facing
and external surfaces must use `invokeCommandWithPolicy()` or one of the
guarded CLI/MCP adapters:

```ts
import {invokeCommandWithPolicy} from '@sqlrooms/room-store';

const result = await invokeCommandWithPolicy(
  roomStore,
  'room.remove-data-source',
  {tableName: 'old_sales'},
  {
    surface: 'api',
    actor: 'workspace-service',
    traceId: requestId,
    signal: abortController.signal,
  },
  {confirmed: userConfirmedRemoval},
);
```

The guard rechecks that the command exists and is currently enabled immediately
before execution. It rejects high-risk and confirmation-required commands
unless the caller records explicit user confirmation.

## Expose commands to other surfaces

The same registry can drive several adapters:

| Surface         | Integration                                        |
| --------------- | -------------------------------------------------- |
| Command palette | `<RoomShell.CommandPalette />`                     |
| AI              | `createDefaultAiTools()` or `createCommandTools()` |
| CLI             | `createCommandCliAdapter()`                        |
| MCP             | `createCommandMcpAdapter()`                        |
| Custom API/UI   | `invokeCommandWithPolicy()` or `invokeCommand()`   |

The default AI tools expose `search_commands`, `get_command`,
`execute_command`, and `list_commands`. Model-facing flows should normally use
`search_commands`, inspect the selected command with `get_command` when its
input schema is needed, and then call `execute_command`. This keeps routine
discovery compact while preserving validation and confirmation policy.

CLI and MCP adapters derive portable descriptors from the registry and use the
same guarded invocation semantics:

```ts
import {
  createCommandCliAdapter,
  createCommandMcpAdapter,
} from '@sqlrooms/room-store';

const cli = createCommandCliAdapter(roomStore, {
  defaultActor: 'sqlrooms-cli',
});

const mcp = createCommandMcpAdapter(roomStore, {
  defaultActor: 'sqlrooms-mcp',
  toolNamePrefix: 'room.',
});
```

## Add middleware and telemetry

Pass `createCommandProps` through `createRoomShellSlice()` to apply middleware
and observe every registered command without changing feature implementations:

```ts
const createCommandProps = {
  middleware: [
    async (command, input, context, next) => {
      audit.debug('command requested', {
        commandId: command.id,
        surface: context.invocation.surface,
      });
      return await next();
    },
  ],
  onCommandInvokeSuccess: ({command, result, durationMs}) => {
    telemetry.track('command_success', {
      commandId: command.id,
      code: result.code,
      durationMs,
    });
  },
  onCommandInvokeFailure: ({command, result, durationMs}) => {
    telemetry.track('command_failure', {
      commandId: command.id,
      code: result.code,
      durationMs,
    });
  },
  onCommandInvokeError: ({command, error, durationMs}) => {
    telemetry.track('command_error', {
      commandId: command.id,
      message: String(error),
      durationMs,
    });
  },
};

export const {roomStore} = createRoomStore<RoomState>((set, get, store) => ({
  ...createRoomShellSlice({createCommandProps})(set, get, store),
  // Compose feature slices here.
}));
```

Middleware runs after input validation and may transform the result, wrap
execution, or stop the chain by returning without calling `next()`. Each
middleware function may call `next()` only once.

## Command authoring checklist

- Use a stable, namespaced ID and register the complete family under one owner.
- Delegate state changes to the owning slice.
- Describe the command and every input field for non-UI discovery.
- Set read-only, idempotency, risk, and confirmation metadata explicitly.
- Return stable IDs and chosen defaults needed by follow-up actions.
- Use guarded invocation for agents and external clients.
- Register and unregister feature-owned commands with the feature lifecycle.

See the [`@sqlrooms/room-store` API reference](/api/room-store/) for registry
and adapter types, the [`@sqlrooms/room-shell` API reference](/api/room-shell/)
for the palette, [Artifacts](/artifacts), and
[Blocks and Block Documents](/blocks-and-documents).
