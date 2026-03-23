High-level AI package for SQLRooms.

This package combines:

- AI slice state/logic (`@sqlrooms/ai-core`)
- AI settings UI/state (`@sqlrooms/ai-settings`)
- AI config schemas (`@sqlrooms/ai-config`)
- SQL query tool helpers (`createDefaultAiTools`, `createQueryTool`)

Use this package when you want AI chat + tool execution in a SQLRooms app without wiring low-level pieces manually.

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

## Related packages

- `@sqlrooms/ai-core` for lower-level AI slice and chat primitives
- `@sqlrooms/ai-settings` for settings slice/components only
- `@sqlrooms/ai-config` for Zod schemas and migrations
