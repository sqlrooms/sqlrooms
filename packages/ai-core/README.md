Core AI slice, chat UI primitives, and tool-streaming utilities for SQLRooms.

Use `@sqlrooms/ai-core` when you want lower-level control over AI state/transport/UI.
For most apps, use the higher-level `@sqlrooms/ai` package.

## Installation

```bash
npm install @sqlrooms/ai-core @sqlrooms/room-store @sqlrooms/ui zod ai
```

`@sqlrooms/ui` is a peer dependency used for Chat UI rendering/styling.
You typically import Chat components from `@sqlrooms/ai-core`, but `@sqlrooms/ui` must be installed for the visual components to work.

## Store setup (core mode)

`createAiSlice` requires:

- `tools` – an AI SDK `ToolSet` (created via the `tool()` helper from `ai`)
- `getInstructions`
- `toolRenderers` (optional) – a `ToolRendererRegistry` mapping tool names to React components

> **Upgrading from 0.28.x?** See the [0.29.0 migration guide](https://sqlrooms.org/upgrade-guide#_0-29-0-upcoming) for the full list of breaking changes: `parameters` → `inputSchema`, `component` → `toolRenderers`, `setSessionToolAdditionalData` removed.

```tsx
import {
  createAiSlice,
  type AiSliceState,
  type ToolRendererRegistry,
} from '@sqlrooms/ai-core';
import {
  BaseRoomStoreState,
  createBaseRoomSlice,
  createRoomStore,
} from '@sqlrooms/room-store';
import {tool} from 'ai';
import {z} from 'zod';

const EchoResult = ({
  output,
}: {
  output: {success: boolean; text: string} | undefined;
}) => <div>{output?.text}</div>;

type State = BaseRoomStoreState & AiSliceState;

export const {roomStore, useRoomStore} = createRoomStore<State>(
  (set, get, store) => ({
    ...createBaseRoomSlice()(set, get, store),
    ...createAiSlice({
      getInstructions: () => 'You are a helpful analytics assistant.',
      tools: {
        echo: tool({
          description: 'Echo text back',
          inputSchema: z.object({text: z.string()}),
          execute: async ({text}) => ({success: true, text: `Echo: ${text}`}),
        }),
      },
      toolRenderers: {
        echo: EchoResult,
      },
    })(set, get, store),
  }),
);
```

## Chat UI

```tsx
import {Chat} from '@sqlrooms/ai-core';

export function AiPanel() {
  return (
    <Chat>
      <Chat.Sessions />
      <Chat.Messages />
      <Chat.PromptSuggestions>
        <Chat.PromptSuggestions.Item text="What trends should I investigate first?" />
      </Chat.PromptSuggestions>
      <Chat.Composer placeholder="Ask a question" />
    </Chat>
  );
}
```

## AgentChat

`AgentChat` is a lightweight, stateless chat surface driven by an externally constructed `ToolLoopAgent`. Unlike the session-based `Chat` component it owns no session list, no AI slice, no model selector, and no persistence — it is intended for transient, single-purpose conversations such as authoring wizards, inline approvals, or one-shot agent flows.

### Key props

| Prop                 | Type                              | Description                                                                           |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| `agent`              | `ToolLoopAgent`                   | A pre-built agent. The caller owns model, tools, system prompt, and provider options. |
| `initialMessages`    | `UIMessage[]`                     | Seed messages shown on mount. State is local after mount.                             |
| `initialSuggestions` | `string[]`                        | Prompt chips shown before the first message is sent.                                  |
| `toolRenderBehavior` | `ToolRenderBehavior`              | Customize tool-call labels and rendering structure.                                   |
| `onMessagesChange`   | `(messages: UIMessage[]) => void` | Notified on every stream delta; useful for mirroring messages to external state.      |
| `placeholder`        | `string`                          | Textarea placeholder text.                                                            |

### Usage

```tsx
import {AgentChat} from '@sqlrooms/ai-core';
import {createToolLoopAgent, tool} from 'ai';
import {z} from 'zod';

const agent = createToolLoopAgent({
  model: myLanguageModel,
  system: 'You are a helpful assistant.',
  tools: {
    greet: tool({
      description: 'Greet the user',
      inputSchema: z.object({name: z.string()}),
      execute: async ({name}) => `Hello, ${name}!`,
    }),
  },
});

function WizardPanel() {
  return (
    <AgentChat
      agent={agent}
      initialSuggestions={['Get started', 'Show me an example']}
      placeholder="Ask anything..."
      onMessagesChange={(msgs) => console.log(msgs)}
    />
  );
}
```

## Useful exports

- Slice/hooks: `createAiSlice`, `useStoreWithAi`, `AiSliceState`
- Chat UI: `Chat`, `ModelSelector`, `QueryControls`, `PromptSuggestions`
- Legacy/compat components: `AnalysisResultsContainer`, `AnalysisResult`, `ErrorMessage`
- Types: `ToolRendererProps`, `ToolRenderer`, `ToolRendererRegistry`, `StoredTool`, `StoredToolSet`
- Tool/agent utilities:
  - `cleanupPendingAnalysisResults`
  - `fixIncompleteToolCalls`
  - `streamSubAgent`

## Related packages

- `@sqlrooms/ai` (recommended high-level integration)
- `@sqlrooms/ai-settings` (provider/model settings slice + UI)
- `@sqlrooms/ai-config` (config schemas and migrations)
