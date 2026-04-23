---
outline: 2
---

# Upgrade Guide

This document provides detailed guidance for upgrading between different versions of SQLRooms packages. Each section outlines breaking changes, required code modifications, and implementation examples to ensure a smooth upgrade process.

When upgrading, please follow the version-specific instructions below that apply to your project. If you encounter any issues during the upgrade process, please refer to our [GitHub issues](https://github.com/sqlrooms/sqlrooms/issues) or contact support.

## 0.29.0 (upcoming)

### `@sqlrooms/ai-core`, `@sqlrooms/ai`: Upgraded to AI SDK v6 with `ToolLoopAgent` (breaking)

The AI SDK dependency has been upgraded from v5 to v6. Tool execution now uses `ToolLoopAgent` instead of `streamText`. If you only use `createAiSlice` without customization, no changes are needed — the transport layer is updated internally.

#### Sub-agent composition

The tool-as-agent pattern now uses `ToolLoopAgent` + `streamSubAgent`:

```ts
// Before (v5)
const result = await streamText({
  model,
  system: instructions,
  messages: [{role: 'user', content: prompt}],
  tools,
  maxSteps: 10,
});

// After (v6)
import {ToolLoopAgent, stepCountIs} from 'ai';
import {streamSubAgent} from '@sqlrooms/ai';

const agent = new ToolLoopAgent({
  model,
  instructions,
  tools,
  stopWhen: stepCountIs(10),
  temperature: 0,
});
const resultText = await streamSubAgent(agent, prompt, abortSignal);
```

#### `addToolResult` → `addToolOutput`

```ts
// Before
addToolResult({toolCallId, result: {...}});

// After — note: `tool` is a new required field in v6
addToolOutput({tool: toolName, toolCallId, output: {...}});
```

#### `ToolRendererProps` new states

Tool renderers may now receive three additional states for approval workflows: `approval-requested`, `approval-responded`, and `output-denied`. Update any exhaustive switch/if-else on `state` in custom renderers.

#### Remote transport

If you use `createRemoteChatTransportFactory`, your server-side route must migrate from `streamText` to `ToolLoopAgent` + `createAgentUIStreamResponse`. The transport now sends `instructions`, `maxSteps`, and `temperature` in the request body.

> **Note:** The [`ai-nextjs` example](https://github.com/sqlrooms/sqlrooms/blob/main/examples/ai-nextjs/src/app/api/chat/route.ts) shows a reference implementation that intentionally ignores these client-supplied fields and uses server-controlled defaults for security. Production endpoints should decide whether to trust client-supplied values for `instructions`, `maxSteps`, and `temperature` based on their security model.

### `@sqlrooms/kepler`: `initialKeplerState` was replaced with `createInitialMapKeplerState` (breaking)

`createKeplerSlice()` no longer accepts a static `initialKeplerState` object.

Use `createInitialMapKeplerState` instead. It is called whenever a map's kepler state is initialized, so consumers can override the default map state and, if needed, derive things like the basemap style from the current theme by calling `getTheme()`.

#### Before

```ts
createKeplerSlice({
  initialKeplerState: {
    mapStyle: {
      styleType: 'positron',
    },
  },
});
```

#### After

```ts
import {getTheme} from '@sqlrooms/ui';

createKeplerSlice({
  createInitialMapKeplerState: ({defaultInitialMapKeplerState}) => ({
    ...defaultInitialMapKeplerState,
    mapStyle: {
      ...defaultInitialMapKeplerState.mapStyle,
      styleType: getTheme() === 'dark' ? 'dark-matter' : 'positron',
    },
  }),
});
```

### `@sqlrooms/ui`: `toast` export now uses Sonner (breaking)

The top-level `toast` export from `@sqlrooms/ui` now points to Sonner's API.

- **Before**: `toast({...})` used SQLRooms' legacy Radix-based object API.
- **After**: `toast.success(...)`, `toast.error(...)`, etc. use Sonner.

If you still need the old API temporarily, import `legacyToast` from `@sqlrooms/ui`.

#### Before

```tsx
import {toast} from '@sqlrooms/ui';

toast({
  variant: 'default',
  title: 'Table created',
  description: 'File loaded',
});
```

#### After (Sonner)

```tsx
import {toast} from '@sqlrooms/ui';

toast.success('Table created', {
  description: 'File loaded',
});
```

#### Temporary compatibility option

```tsx
import {legacyToast} from '@sqlrooms/ui';

legacyToast({
  variant: 'default',
  title: 'Table created',
  description: 'File loaded',
});
```

### `@sqlrooms/ai`, `@sqlrooms/vega`, `@sqlrooms/ai-rag`: Tools migrated to native AI SDK format (breaking)

All built-in tools and the tool authoring API now use the AI SDK's `tool()` factory instead of the OpenAssistant format. The `@openassistant/utils` dependency has been removed.

#### Custom tools: before

```ts
import {z} from 'zod';

const myTool = {
  name: 'my_tool',
  description: 'Does something',
  parameters: z.object({text: z.string()}),
  execute: async ({text}) => ({
    llmResult: {success: true, details: `Result: ${text}`},
    additionalData: {processed: text},
  }),
  component: MyToolResult, // renderer attached to tool
};
```

#### Custom tools: after

```ts
import {tool} from 'ai';
import {z} from 'zod';

const myTool = tool({
  description: 'Does something',
  inputSchema: z.object({text: z.string()}),
  execute: async ({text}) => ({
    // flat output — no llmResult / additionalData nesting
    success: true,
    details: `Result: ${text}`,
    processed: text,
  }),
  // optional: control what the LLM sees (defaults to full JSON)
  toModelOutput: ({output}) => ({type: 'text', value: output.details}),
});
// renderer is registered separately — see toolRenderers below
```

### `@sqlrooms/ai-core`, `@sqlrooms/ai`: Tool renderers decoupled from tools (breaking)

Tool renderers (`component`) are no longer attached to individual tools. They are now registered once in `createAiSlice` via the new `toolRenderers` option, typed against the tools map.

#### Before

```ts
createAiSlice({
  tools: {
    query: createQueryTool(store), // had component: QueryToolResult
    chart: createVegaChartTool(), // had component: VegaChartToolResult
  },
  // ...
});
```

#### After

```ts
import {createDefaultAiTools, createDefaultAiToolRenderers} from '@sqlrooms/ai';
import {VegaChartToolResult} from '@sqlrooms/vega';

createAiSlice({
  tools: {
    ...createDefaultAiTools(store),
    chart: createVegaChartTool(),
  },
  toolRenderers: {
    ...createDefaultAiToolRenderers(), // includes QueryToolResult
    chart: VegaChartToolResult,
    // myCustomTool: MyCustomToolResult,
  },
  // ...
});
```

### `@sqlrooms/ai`: Tool output type renames (breaking)

The `llmResult`/`additionalData` split has been replaced with a single flat output type per tool.

| Package            | Old type                                                 | New type                                |
| ------------------ | -------------------------------------------------------- | --------------------------------------- |
| `@sqlrooms/ai`     | `QueryToolLlmResult` + `QueryToolAdditionalData`         | `QueryToolOutput`                       |
| `@sqlrooms/ai`     | `QueryToolOutput.errorMessage`                           | `QueryToolOutput.error`                 |
| `@sqlrooms/vega`   | `VegaChartToolLlmResult` + `VegaChartToolAdditionalData` | `VegaChartToolOutput`                   |
| `@sqlrooms/vega`   | `VegaChartToolArgs` (type alias)                         | removed — use `VegaChartToolParameters` |
| `@sqlrooms/vega`   | `VegaChartToolContext`                                   | removed                                 |
| `@sqlrooms/ai-rag` | `RagToolAdditionalData` + `RagToolContext`               | removed — use `RagToolOutput`           |

### `@sqlrooms/ai`: `QueryToolResult` props changed (breaking)

`QueryToolResult` now receives `ToolRendererProps<QueryToolOutput, QueryToolParameters>` instead of standalone props. If you render it directly, update the call-site:

#### Before

```tsx
<QueryToolResult
  title="My query"
  sqlQuery={sql}
  showSql={false}
  formatValue={myFormatter}
/>
```

#### After

Use `createQueryToolRenderer` and register it in `toolRenderers`:

```ts
import {createQueryToolRenderer} from '@sqlrooms/ai';

toolRenderers: {
  query: createQueryToolRenderer({showSql: false, formatValue: myFormatter}),
}
```

### `@sqlrooms/vega`: `createVegaChartTool` options removed (breaking)

The `embedOptions`, `editable`, and `editorMode` options have been removed from `createVegaChartTool`. Pass them directly as props to `VegaChartToolResult` instead.

#### Before

```ts
createVegaChartTool({editable: false, editorMode: 'sql'});
```

#### After

```tsx
import {VegaChartToolResult} from '@sqlrooms/vega';

// In your toolRenderers:
toolRenderers: {
  chart: (props) => <VegaChartToolResult {...props} editable={false} editorMode="sql" />,
}
```

### `@sqlrooms/ai-rag`: `ragToolRenderer` exported separately (breaking)

The RAG tool renderer is no longer attached to the tool. Import and register it explicitly.

#### Before

```ts
// renderer was bundled inside createRagTool() as `component`
tools: {
  search_documentation: createRagTool();
}
```

#### After

```ts
import {createRagTool, ragToolRenderer} from '@sqlrooms/ai-rag';

tools: {search_documentation: createRagTool()},
toolRenderers: {search_documentation: ragToolRenderer},
```

### `@sqlrooms/ai-core`: In-chat tool result editing removed (breaking)

The `setSessionToolAdditionalData` API and the `toolAdditionalData` session field have been removed. In-chat editing of tool results (e.g. inline Vega chart spec editing) is no longer supported — charts and other tool outputs are now rendered read-only within the chat.

```ts
// Before
state.ai.setSessionToolAdditionalData(sessionId, toolCallId, data);

// After — remove the call entirely; no replacement needed.
```

If you were using `toolAdditionalData` to persist user edits to charts, extract the chart into a first-class entity stored independently of the chat instead. Persisted sessions with `toolAdditionalData` are automatically cleaned up on load.

### `@sqlrooms/ai`: Remote transport — drop `data-tool-additional-output` custom chunk (breaking)

If you have a custom Next.js (or other server-side) route that manually wrote `data-tool-additional-output` data chunks to ferry `additionalData` to the client, you can remove that code entirely.

#### Before

```ts
// app/api/chat/route.ts
result.pipeThrough(
  new TransformStream({
    async onChunk({chunk}) {
      if (chunk.type === 'tool-result') {
        writer.write({
          type: 'data-tool-additional-output',
          transient: true,
          data: {
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            output: getToolAdditionalData(chunk.toolCallId),
          },
        });
      }
    },
  }),
);
```

#### After

Remove the `onChunk` handler. `createAgentUIStreamResponse` embeds the full tool `execute()` output directly into the `UIMessage` stream as a `tool-result` part, which the renderer receives via `ToolRendererProps.output`. No side-channel is needed.

```ts
// chatTransport.ts — inside the local transport factory
return createAgentUIStreamResponse({
  agent,
  uiMessages: sanitizeMessagesForLLM(fixIncompleteToolCalls(messagesCopy)),
  abortSignal,
});
```

**Why this works:** Previously, `execute()` returned `{llmResult, additionalData}` — the UI data (`additionalData`) was separate and had to be sent manually. Now `execute()` returns a single flat output object. The AI SDK propagates the full output to the client through the standard `UIMessage` parts, so `ToolRendererProps.output` is populated automatically without any custom data chunks.

### `@sqlrooms/ai-core`: Removed exports

- `convertToAiSDKTools` — removed (tools are now native AI SDK tools)
- `findToolComponent` — replaced by `findToolRenderer`
- `VegaChartToolParametersType` from `@sqlrooms/vega` — removed (use `VegaChartToolParameters` directly)

## 0.28.0

### Tailwind v3 to v4

Tailwind in SQLRooms is now upgraded from v3 to v4.

For the full migration checklist and additional breaking changes, see the official Tailwind upgrade guide: [https://tailwindcss.com/docs/upgrade-guide](https://tailwindcss.com/docs/upgrade-guide).

You can use the official migration tool directly in your repository:

```sh
npx @tailwindcss/upgrade
```

#### Manual steps

The main migration step is moving template/content discovery from `tailwind.config.js` into your global CSS using `@source` directives (see `examples/query/src/index.css` for a complete example).

##### Step 1

Move content paths from `tailwind.config.js` to global css `index.css`. Also, add `index.html` and pay attention to relative paths since `index.css` is usually located under `src/` folder while `tailwind.config.js` is in the root.

```css
/* index.css */

@import 'tailwindcss';

@import '@sqlrooms/ui/tailwind-preset.css';

@source '../index.html';
@source './**/*.{ts,tsx}';
@source '../node_modules/@sqlrooms/*/dist/';

/* styles */
```

##### Step 2

Remove `tailwind.config.js`

##### Step 3

Remove `@layer base { ... }` from `index.css`

Before:

```css
/* index.css */

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    /* ... */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... */
  }
}
```

After:

```css
/* index.css */

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... */
}
```

##### Step 4: For Vite projects

- Install `@tailwindcss/vite` and add it to your `vite.config.js` file,

```bash
pnpm add -D @tailwindcss/vite
```

```javascript
// vite.config.js

import {defineConfig} from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

- Remove `autoprefixer` and `postcss`
- Remove `postcss.config.js`

##### Step 4: For NextJS projects

Update `postcss.config.js`

Before:

```javascript
// postcss.config.js

const config = {
  plugins: ['@tailwindcss/postcss'],
};

export default config;
```

After:

```javascript
// postcss.config.js

const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
export default config;
```

## 0.27.0-rc.0

### @sqlrooms/mosaic

- `useMosaic` hook removed: Use `MosaicSlice` and `useMosaicClient` instead

The `useMosaic` hook has been replaced with a more robust slice-based architecture. You now need to:

1. Add `MosaicSlice` to your room store
2. Check connection status via the store
3. Use `useMosaicClient` for reactive data queries

#### Before

```tsx
import {useMosaic} from '@sqlrooms/mosaic';

function MyComponent() {
  const {isMosaicLoading, mosaicConnector} = useMosaic();

  if (isMosaicLoading) {
    return <div>Loading...</div>;
  }

  // Use mosaicConnector directly
  // ...
}
```

#### After

**Step 1: Add MosaicSlice to your store**

```tsx
import {createMosaicSlice, MosaicSliceState} from '@sqlrooms/mosaic';
import {createRoomStore, RoomShellSliceState} from '@sqlrooms/room-shell';

export type RoomState = RoomShellSliceState & MosaicSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    // ... other slices
    ...createMosaicSlice()(set, get, store),
  }),
);
```

**Step 2: Check connection status via store**

```tsx
import {useRoomStore} from './store';

function MyComponent() {
  const mosaicConn = useRoomStore((state) => state.mosaic.connection);

  if (mosaicConn.status === 'loading') {
    return <div>Loading...</div>;
  }

  if (mosaicConn.status === 'error') {
    return <div>Error: {mosaicConn.error.message}</div>;
  }

  // Mosaic is ready when status === 'ready'
  // Access connector via mosaicConn.connector if needed
}
```

**Step 3: Use `useMosaicClient` for reactive queries**

```tsx
import {Query, useMosaicClient} from '@sqlrooms/mosaic';

function MapView() {
  const {data, isLoading, client} = useMosaicClient({
    selectionName: 'brush',
    query: (filter: any) => {
      return Query.from('earthquakes')
        .select('Latitude', 'Longitude', 'Magnitude')
        .where(filter);
    },
  });

  if (isLoading) {
    return <div>Loading data...</div>;
  }

  // Use data for visualization
  return <div>Data loaded: {data?.numRows} rows</div>;
}
```

For more details, see the [Mosaic API documentation](/api/mosaic/) and the [DeckGL + Mosaic example](https://github.com/sqlrooms/examples/tree/main/deckgl-mosaic).

### @sqlrooms/ai

#### Per-session chat + analysis state

AI chat state is now **scoped per session** (instead of a single global chat instance). This enables multiple sessions to stream concurrently without overwriting each other when you switch sessions.

- **Removed global state**: `state.ai.prompt`, `state.ai.isRunning` (now per-session)
- **Breaking method signature changes**:
  - `startAnalysis(sendMessage)` → `startAnalysis(sessionId)`
  - `cancelAnalysis()` → `cancelAnalysis(sessionId)`
- **New per-session accessors**:
  - `getPrompt(sessionId)` / `setPrompt(sessionId, prompt)`
  - `getIsRunning(sessionId)` / `setIsRunning(sessionId, isRunning)`
- **New hook**: `useSessionChat(sessionId)` for session-scoped chat (replaces legacy single-instance patterns)
- **Mounting requirement**: if you render AI primitives directly (e.g. `QueryControls`, `AnalysisResultsContainer`) you must mount chat providers once via `Chat.Root` (it mounts `SessionChatManager`).

#### Before

```tsx
const prompt = useRoomStore((s) => s.ai.prompt);
const isRunning = useRoomStore((s) => s.ai.isRunning);

// startAnalysis used to take a sendMessage fn (global chat instance)
await useRoomStore.getState().ai.startAnalysis(sendMessage);
```

#### After

```tsx
const currentSession = useRoomStore((s) => s.ai.getCurrentSession());
const sessionId = currentSession?.id;

const prompt = useRoomStore((s) =>
  sessionId ? s.ai.getPrompt(sessionId) : '',
);
const isRunning = useRoomStore((s) =>
  sessionId ? s.ai.getIsRunning(sessionId) : false,
);

if (sessionId) {
  await useRoomStore.getState().ai.startAnalysis(sessionId);
}
```

#### Recommended UI composition

Use `Chat.Root` once at the top of your AI UI tree (it mounts `SessionChatManager`):

```tsx
import {Chat} from '@sqlrooms/ai';

export function MyAiPanel() {
  return (
    <Chat.Root>
      <Chat.Sessions />
      <Chat.Messages />
      <Chat.Composer />
    </Chat.Root>
  );
}
```

## 0.26.0-rc.5

- There's no combined config in the store anymore. We decided to split the config into individual slices' configs to avoid confusion and simplify the store typing.

      state.config.title -> state.room.config.title
      state.config.dataSources -> state.room.config.dataSources
      state.config.sqlEditor -> state.sqlEditor.config
      state.config.layout -> state.layout.config
      ...

  If you were saving the combined config, make sure to update the persistence logic (check out the examples).

- createStore, createSlice now only have one generic type parameter

- room.setRoomConfig removed, use .setConfig in all individual slices

- RoomState renamed to BaseRoomStoreState (meant to be internal) and RoomStore interface renamed to BaseRoomStore to avoid confusion with RoomState/RoomStore introduced in many of the examples

- room.onSaveConfig, hasUnsavedChanges, lastSavedConfig were removed.

## 0.25.0-rc.1

- createAiSlice init parameters changed:
  - Instead of customTools and toolsOptions use tools + createDefaultAiTools(store, toolsOptions)
  - getInstructions must be provided, but can use createDefaultAiInstructions(store)

## 0.24.28-rc.1

- Discuss config separated from RoomConfig to make it easier to persist separately and to simplify typing (`state.discuss.config` instead of `state.config.discuss`)

```tsx
const discussConfig = useRoomStore((state) => state.discuss.config);
```

After:

```tsx
const discussConfig = useRoomStore((state) => state.config.discuss);
```

If you were persisting this state, you will likely need a migration.

You should also remove `.merge(DiscussSliceConfig)` when defining your `RoomConfig`

## 0.19.0

We are trying to make the package structure more logical, especially, for new users of the SQLRooms framework. Sorry for the more renaming.

- Package `@sqlrooms/core` (previously, `@sqlrooms/project`) renamed to `@sqlrooms/room-store`.

- The layout-related state and functions were moved to the new `LayoutSlice` added to `@sqlrooms/layout` which is namespaced as `layout`:
  - `panels`
  - `setLayout`
  - `togglePanel`
  - `tooglePanelPin`

Before:

```tsx
const togglePanel = useRoomStore((state) => state.room.togglePanel);
```

After:

```tsx
const togglePanel = useRoomStore((state) => state.layout.togglePanel);
```

## 0.18.0

`QueryHandle` returned from `.query()` is now implementing `PromiseLike` and can be awaited. So adding `.result`, which was introduced in [0.16.0](#_0-16-0), is not necessary anymore.

### Old

```tsx
const result = await connector.query('SELECT * FROM some_table').result;
```

### New

```tsx
const result = await connector.query('SELECT * FROM some_table');
```

## 0.17.0

This release focuses on standardizing terminology across the codebase and improving the developer experience for new users. We are replacing the concept of "project" with "room" to better align with the SQLRooms name. "Room" is an established concept in collaborative apps and fits well with the overall vision of the project.

### Package name changes

- `@sqlrooms/project` renamed to `@sqlrooms/core` (renamed again to `@sqlrooms/room-store` in [0.19.0](#_0-19-0), sorry)
- `@sqlrooms/project-config` renamed to `@sqlrooms/room-config`
- `@sqlrooms/project-builder` renamed to `@sqlrooms/room-shell`

### Component name changes

- `ProjectBuilder` is replaced by `RoomShell`
- `ProjectBuilderProvider` is removed (in favor of `RoomShell`)
- `ProjectBuilderState` renamed to `RoomShellSliceState`
- `createProjectBuilderStore` renamed to `createRoomStore`
- `createProjectBuilderSlice` renamed to `createRoomShellSlice`
- `ProjectBuilderPanel` renamed to `RoomPanel`
- `ProjectBuilderPanelHeader` renamed to `RoomPanelHeader`

#### Old way to set up a project

```tsx
<ProjectBuilderProvider projectStore={projectStore}>
  <div className="flex h-full w-full">
    <div className="bg-muted/50 flex h-full flex-col px-1 py-2">
      <ProjectBuilderSidebarButtons />
    </div>
    <div className="flex h-full w-full flex-col">
      <ProjectBuilder />
    </div>
  </div>
</ProjectBuilderProvider>
```

#### New

```tsx
<RoomShell className="h-screen" roomStore={roomStore}>
  <RoomShell.Sidebar />
  <RoomShell.LayoutComposer />
  <RoomShell.LoadingProgress />
  <RoomShell.CommandPalette />
</RoomShell>
```

### State name changes

- `state.project` namespace renamed to `state.room`

#### Old

```tsx
const dataSources = useProjectStore((state) => state.project.dataSources);
```

#### New

```tsx
const dataSources = useRoomStore((state) => state.room.dataSources);
```

## 0.16.3

### @sqlrooms/duckdb

The `BaseDuckDbConnector` and `WasmDuckDbConnector` are now provided as factory functions rather than classes. Use `createWasmDuckDbConnector()` or the generic `createDuckDbConnector({type: 'wasm'})` to obtain a connector instance.

#### Before

```typescript
import {WasmDuckDbConnector} from '@sqlrooms/duckdb';

const connector = new WasmDuckDbConnector();
```

#### After

```typescript
import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';

const connector = createWasmDuckDbConnector();
```

## 0.16.0

### @sqlrooms/duckdb

The DuckDbConnector now supports query cancellation through a unified `QueryHandle` interface with full composability support. All query methods (`execute`, `query`, `queryJson`) now return a `QueryHandle` that provides immediate access to cancellation functionality and signal composability. [Read more…](https://sqlrooms.org/query-cancellation)

#### Old

```tsx
const result = await connector.query('SELECT * FROM some_table');
```

#### New

::: warning
Since [0.18.0](#_0-18-0) `QueryHandle` returned from `.query()` is implementing `PromiseLike` and can be awaited. So adding `.result` is not necessary anymore.
:::

```tsx
const result = await connector.query('SELECT * FROM some_table').result;
```

## 0.14.0

### @sqlrooms/ui

- `sqlroomsTailwindPreset` prefix parameter was removed

## 0.9.0

### @sqlrooms/project-builder

- `createProjectSlice` renamed into `createProjectBuilderSlice`

- `createProjectStore` renamed into `createProjectBuilderStore`

- `ProjectState` renamed into `ProjectBuilderState`

- `projectId` and `setProjectId` removed: add custom state if necessary

- `INITIAL_BASE_PROJECT_STATE` renamed into `INITIAL_PROJECT_BUILDER_STATE`

- A number of project store props and moved from `.project` to `.db`:
  - `.tables`
  - `.addTable`
  - `.getTable`
  - `.getTables`
  - `.getTableRowCount`
  - `.getTableSchema`
  - `.getTableSchemas`
  - `.checkTableExists`
  - `.dropTable`
  - `.createTableFromQuery`
  - `.setTableRowCount`
  - `.findTableByName`
  - `.refreshTableSchemas`

- `useBaseProjectStore` was renamed into `useBaseProjectBuilderStore`, but it's better to use `useProjectStore` returned by `createProjectBuilderStore` instead

- `processDroppedFile()` is removed: Use `ProjectStore.addProjectFile` directly.

- `ProjectStore.replaceProjectFile` is removed: Use `ProjectStore.addProjectFile` instead.

- `ProjectStore.addProjectFile` parameter changes: The function now takes a File or a pathname instead of the result of `processDroppedFile()`.

- `ProjectStore.addProjectFile` behavior changes: The function will no longer attempt to create unique table names, but will overwrite the created table.

- `ProjectStore.areViewsReadyToRender` and `onDataUpdated` were removed

- `ProjectStore.setTables` removed: use `state.db.refreshTableSchemas()` instead.

- `ProjectStore.isReadOnly` was removed: pass `isReadOnly` as a prop to respective components instead

### @sqlrooms/duckdb

- `useDuckDb()` now returns an instance of [`DuckDbConnector`](api/duckdb/interfaces/DuckDbConnector) to enable support for external DuckDB

- `getDuckDb` was removed: Use `useDuckDb()` instead

- `getDuckTableSchemas` was removed: use `const getTableSchemas = useProjectStore(state => state.db.getTableSchemas)`

- `exportToCsv` was removed: Use `useExportToCsv` instead

### @sqlrooms/mosaic

- `getMosaicConnector` removed: Use `useMosaic` instead

### @sqlrooms/ai

- `TOOLS` is not exported anymore: use `useProjectStore(state => state.ai.tools)` instead

## 0.8.0

### @sqlrooms/project-builder

- `project.config` moved to top level of `ProjectStore`

This was done to simplify persistence. To migrate you need to pull it up in your slice creation code.

Before:

```typescript
const {projectStore, useProjectStore} = createProjectStore<
  RoomConfig,
  RoomState
>(
    (set, get, store) => ({
      ...createProjectSlice<RoomConfig>({
        project: {
          config: {
            ...
          },
          ...
        }
      })
    })
);
```

After:

```typescript
const {projectStore, useProjectStore} = createProjectStore<
  RoomConfig,
  RoomState
>(
    (set, get, store) => ({
      ...createProjectSlice<RoomConfig>({
        config: {
          ...
        },
        project: {
          ...
        }
      })
    })
);
```

Check the [AI example store code](https://github.com/sqlrooms/examples/blob/main/ai/src/store.ts).

### @sqlrooms/ai

- Model provider in `getApiKey`

`getApiKey` property of `createAiSlice` now takes `modelProvider`:

```typescript
...createAiSlice({
getApiKey: (modelProvider: string) => {
  return get()?.apiKeys[modelProvider] || '';
},
})(set, get, store),

```

- Combining `useScrollToBottom` and `useScrollToBottomButton`

`useScrollToBottom` is now combined with `useScrollToBottomButton`. `useScrollToBottom` now takes `dataToObserve`, `containerRef`, `endRef`. When the data changes, the hook will scroll to the bottom of the container.

- Vega Chart Tool is now a custom tool

The Vega Chart Tool is no longer included by default and must be explicitly provided as a custom tool to `createAiSlice`. You need to import it from `@sqlrooms/vega` and add it to the `customTools` object:

```typescript
import {createVegaChartTool} from '@sqlrooms/vega';

...createAiSlice({
  getApiKey: (modelProvider: string) => {
    return get()?.apiKeys[modelProvider] || '';
  },
  // Add custom tools
  customTools: {
    // Add the VegaChart tool from the vega package
    chart: createVegaChartTool(),
    // Other custom tools...
  },
})(set, get, store),
```

This change allows for more flexibility in configuring the chart tool and reduces bundle size for applications that don't need chart functionality.
