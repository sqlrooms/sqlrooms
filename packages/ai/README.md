High-level AI package for SQLRooms.

This package combines:

- AI slice state/logic (`@sqlrooms/ai-core`)
- AI settings UI/state (`@sqlrooms/ai-settings`)
- AI config schemas (`@sqlrooms/ai-config`)
- SQL query and schema discovery tool helpers (`createDefaultAiTools`, `createQueryTool`, `createTableSchemaTools`)

Use this package when you want AI chat + tool execution in a SQLRooms app without wiring low-level pieces manually.

`createDefaultAiInstructions` includes a hybrid DuckDB table context: small
current-database `main` catalogs include full schemas for every table, while
larger catalogs include a few full schemas, additional table names with row
counts, and instructions to call
`describe_table_schema` before querying tables whose columns are not shown.
`createDefaultAiTools` registers `list_tables` and `describe_table_schema` by
default so apps can expose the same table discovery workflow. These tools
search the current database `main` schema by default, and accept broader
`scope`, `schema`, and `database` parameters for other visible schemas or
attached databases.

## Installation

```bash
npm install @sqlrooms/ai @sqlrooms/room-shell @sqlrooms/duckdb @sqlrooms/ui
```

## Quick start

```tsx
import {
  AiSettingsSliceState,
  AiSliceState,
  createAiSettingsSlice,
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiTools,
} from '@sqlrooms/ai';
import {
  createRoomShellSlice,
  createRoomStore,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';

type RoomState = RoomShellSliceState & AiSliceState & AiSettingsSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    ...createRoomShellSlice({
      config: {
        dataSources: [
          {
            type: 'url',
            tableName: 'earthquakes',
            url: 'https://huggingface.co/datasets/sqlrooms/earthquakes/resolve/main/earthquakes.parquet',
          },
        ],
      },
    })(set, get, store),

    ...createAiSettingsSlice()(set, get, store),

    ...createAiSlice({
      tools: {
        ...createDefaultAiTools(store),
      },
      getInstructions: () => createDefaultAiInstructions(store),
    })(set, get, store),
  }),
);
```

## Render chat UI

```tsx
import {Chat} from '@sqlrooms/ai';
import {useRoomStore} from './store';

function AiPanel() {
  const updateProvider = useRoomStore(
    (state) => state.aiSettings.updateProvider,
  );

  return (
    <Chat>
      <Chat.Sessions />
      <Chat.Messages />
      <Chat.PromptSuggestions>
        <Chat.PromptSuggestions.Item text="Summarize the available tables" />
      </Chat.PromptSuggestions>
      <Chat.Composer placeholder="Ask a question about your data">
        <Chat.InlineApiKeyInput
          onSaveApiKey={(provider, apiKey) => {
            updateProvider(provider, {apiKey});
          }}
        />
        <Chat.ModelSelector />
      </Chat.Composer>
    </Chat>
  );
}
```

## Add custom tools

```tsx
import {z} from 'zod';
import {
  createAiSlice,
  createDefaultAiInstructions,
  createDefaultAiTools,
} from '@sqlrooms/ai';

// inside createRoomStore(...):
createAiSlice({
  tools: {
    ...createDefaultAiTools(store),
    echo: {
      name: 'echo',
      description: 'Return user text back to the chat',
      parameters: z.object({
        text: z.string(),
      }),
      execute: async ({text}) => ({
        llmResult: {
          success: true,
          details: `Echo: ${text}`,
        },
      }),
    },
  },
  getInstructions: () => createDefaultAiInstructions(store),
})(set, get, store);
```

Tool `execute` callbacks receive hidden run-context helpers in their second
argument. Apps can use `getRunContext` to capture selected artifacts at the
start of a run, expose them in `formatRunContextInstructions`, and then let
tools update the effective primary context with `setPrimaryRunContextItem`.
Old contexts without `primaryItemId` remain valid; the first item is treated as
primary. Artifact-specific context tools live in `@sqlrooms/artifacts/ai`.

## Use remote endpoint mode

If you want server-side model calls, set `chatEndPoint` and optional `chatHeaders`:

```tsx
// inside createRoomStore(...):
...createAiSlice({
  tools: {
    ...createDefaultAiTools(store),
  },
  getInstructions: () => createDefaultAiInstructions(store),
  chatEndPoint: '/api/chat',
  chatHeaders: {
    'x-app-name': 'my-sqlrooms-app',
  },
})(set, get, store),
```

## Skills

The skills subsystem lets you define, store, and author reusable AI "skills" — named instruction sets that can be loaded into an agent at runtime.

### Storage and types

`SkillStorage` is the interface that abstracts where skills live (filesystem, database, cloud, etc.). Implement it to plug in your own backend:

- `listRoots()` — enumerate available skill root locations
- `listSkills(rootId)` — list all skills under a root
- `readSkill(ref)` / `writeSkill(ref, content)` / `deleteSkill(ref)` — CRUD on individual skills
- `resolveSkillId(id)` — resolve a bare id to its highest-priority `SkillRef`
- `subscribe?(listener)` — _optional_; subscribe to change notifications. Returns an unsubscribe function. Implementations that don't mutate (read-only/static) may omit this method.

Supporting types: `SkillRoot`, `SkillManifest`, `SkillRef`, `SkillRecord`, `SkillListing`, `SkillWriteContent`, `SkillFile`.

### Composite storage

`CompositeSkillStorage` priority-merges multiple `SkillStorage` instances behind a single `SkillStorage` interface. Children are passed in priority order (highest first); they win conflicts in `resolveSkillId` and appear first in `listRoots`. Each child must own a unique set of `rootId`s.

`subscribe` fans out to every child that exposes the optional `subscribe?` method and aggregates the unsubscribes. If no child supports subscribe, `composite.subscribe(...)` is a noop returning a noop unsubscribe — consumers can call it unconditionally.

```tsx
import {CompositeSkillStorage} from '@sqlrooms/ai';

// Higher-priority `userStorage` wins on id collisions; both contribute roots
// and listings to the merged view.
const storage = new CompositeSkillStorage([userStorage, builtInStorage]);

const roots = await storage.listRoots(); // [user roots..., built-in roots...]
const all = await storage.listSkills(); // union, with duplicates

// Optional change notification: composite forwards from any subscribe-capable
// child.
const unsubscribe = storage.subscribe(() => {
  void refreshUi();
});
// later: unsubscribe();
```

### Manifest utilities

- `parseSkillManifest(raw)` — parse and validate a skill manifest (Zod-backed, throws `SkillManifestError` on failure)
- `serializeSkillManifest(manifest)` — serialize a manifest back to its raw form
- `loadSkillFromFiles(files)` — assemble a `SkillRecord` from a set of `SkillFile` objects (manifest + instruction body)

### Error types

All skill errors extend `SkillError` and carry a typed `SkillErrorCode`:

| Class                    | When thrown                         |
| ------------------------ | ----------------------------------- |
| `SkillManifestError`     | Manifest parse/validation failure   |
| `SkillNotFoundError`     | Skill ref does not exist in storage |
| `SkillRootReadOnlyError` | Write attempted on a read-only root |
| `SkillConflictError`     | Skill ID collision on write         |

### Skill authoring

A built-in agent-driven authoring flow that generates skill content through a conversational UI:

- `createSkillAuthoringAgent(options)` — construct a `ToolLoopAgent` scoped to skill creation; accepts `CreateSkillAuthoringAgentOptions`
- `createSkillDraftStore()` — Zustand store for tracking the in-progress draft (`SkillDraftStore`, `SkillDraftState`)
- `SkillAuthoringPanel` — drop-in panel component that wires `Chat.LocalAgentRoot` to the authoring agent; accepts `SkillAuthoringPanelProps`
- `SkillDraftPreview` — read-only preview of the current draft manifest and instructions; accepts `SkillDraftPreviewProps`
- `DefaultSkillAuthoringPanelHeader` — default header for `SkillAuthoringPanel`

Types: `SkillAuthoringContext`, `SkillDraft`, `SkillDraftStatus`, `SaveSkillCallback`, `CreateSkillAuthoringAgentOptions`.

Lower-level authoring tools (exported for advanced use): `createWriteManifestTool`, `createWriteInstructionsTool`, `createSaveSkillTool`, `buildSkillAuthoringSystemPrompt`, `containsForbidden`, `DEFAULT_SKILL_AUTHORING_STOP_STEPS`.

```tsx
import {
  createSkillAuthoringAgent,
  createSkillDraftStore,
  SkillAuthoringPanel,
} from '@sqlrooms/ai';

const draftStore = createSkillDraftStore();

const agent = createSkillAuthoringAgent({
  model: myLanguageModel,
  draftStore,
  onSave: async (skill) => {
    await mySkillStorage.writeSkill(
      {rootId: 'default', skillId: skill.id},
      skill,
    );
  },
});

function SkillCreator() {
  return <SkillAuthoringPanel agent={agent} draftStore={draftStore} />;
}
```

## Related packages

- `@sqlrooms/ai-core` for lower-level AI slice and chat primitives
- `@sqlrooms/ai-settings` for settings slice/components only
- `@sqlrooms/ai-config` for Zod schemas and migrations
