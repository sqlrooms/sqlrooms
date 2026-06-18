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
- `getAvailableModels` (optional) – returns selectable `{provider, value}` pairs so new sessions can fall back to the first available model when the configured default is missing

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

`Chat.Header` and `Chat.History` can delegate session creation to the host app
with `onCreateSession`. `Chat.History` also accepts `filterSession` and
`emptyLabel` so apps can present scoped histories without changing the generic
AI session schema.

Assistant messages can be forked into a new active chat through
`ai.forkSessionFromMessage()`. The action snapshots the source session's
`uiMessages` through the selected message or chat turn, inherits the source
session's model and draft context item ids, records `sessionForks` provenance,
and lets `Chat.Messages` show a `Forked from` link back to the source chat.

Use `generateSessionTitle` when apps want an imperative helper that turns a
session's early user messages into a concise title via `ai.sendPrompt`, cleans
the model output, and renames the session. Use `useGenerateSessionTitle` in React
surfaces that should watch the current session and trigger the helper after new
user messages. The hook handles debouncing and duplicate-generation guards.
Apps can pass `enabled`, `isDefaultSessionName`, and `getPromptOptions` to keep
app-specific readiness checks and model choices outside the shared package.

## Model wrappers

`createAiSlice` accepts an optional `wrapModel(model)` callback. SQLRooms calls
it for locally-created chat and one-shot generation models before passing them
to the AI SDK. Use this for instrumentation or provider middleware that should
remain outside `@sqlrooms/ai-core` itself.

## Local Agent Chat

Use `Chat.LocalAgentRoot` when a transient surface should be driven by a
pre-constructed `ToolLoopAgent` instead of the session-backed AI slice. The
message and composer components stay under the same `Chat` compound API.

```tsx
<Chat.LocalAgentRoot
  agent={agent}
  initialSuggestions={['Get started', 'Show me an example']}
  onMessagesChange={(msgs) => console.log(msgs)}
>
  <Chat.Messages />
  <Chat.PromptSuggestions />
  <Chat.Composer placeholder="Ask anything..." />
</Chat.LocalAgentRoot>
```

## Chat search

`Chat` renders a `ChatSearchProvider` and exposes `Chat.Search`, an in-conversation
find bar that highlights matches in the current session's messages.

For building search UIs outside the chat (e.g. a session list that searches across
all sessions), the underlying matching primitives are exported and can be used
without the provider:

- `normalizeChatSearchQuery(query)` — trims + lower-cases a query (the casing rule
  the search uses).
- `findChatSearchMatches(blocks, query)` — returns positional matches
  (`ChatSearchMatch[]`) for a list of `ChatSearchBlock`s. Useful for highlighting
  matched substrings consistently with `Chat.Search`.
- `markdownToPlainText(markdown)` — extracts plain text from markdown so message
  content can be made searchable.

```tsx
import {findChatSearchMatches, type ChatSearchBlock} from '@sqlrooms/ai-core';

const blocks: ChatSearchBlock[] = [
  {id: 'title', resultId: 'title', text: title},
];
const matches = findChatSearchMatches(blocks, query);
```

## Useful exports

- Slice/hooks: `createAiSlice`, `useStoreWithAi`, `generateSessionTitle`, `useGenerateSessionTitle`, `AiSliceState`
- Chat UI: `Chat`, `ChatMessagesContainer`, `ChatTurnView`, `MessageContent`, `ModelSelector`, `QueryControls`, `PromptSuggestions`
- Legacy/compat components: `AnalysisResultsContainer`, `AnalysisResult`, `AnalysisAnswer`, `ErrorMessage`
- Session helpers: `ChatSessionSchema`, `isChatSessionEmpty`, `getChatTurnsFromUiMessages`
- Forking: `ai.forkSessionFromMessage()`, `AiSessionForkOrigin`, `ForkSessionFromMessageArgs`
- Types: `ChatTurn`, `ToolRendererProps`, `ToolRenderer`, `ToolRendererRegistry`, `StoredTool`, `StoredToolSet`
- Tool/agent utilities:
  - `cleanupPendingUiMessages`
  - `cleanupPendingAnalysisResults`
  - `fixIncompleteToolCalls`
  - `streamSubAgent`

`AnalysisSessionSchema`, `isAnalysisSessionEmpty`, `AnalysisResultsContainer`,
`AnalysisResult`, `AnalysisAnswer`, `processAnalysisAnswerContent`, and
`cleanupPendingAnalysisResults` remain compatibility exports for existing apps.
New code should prefer `ChatSessionSchema`, `isChatSessionEmpty`,
`Chat.Messages`, `ChatTurnView`, `MessageContent`, `uiMessages`, and derived
`ChatTurn` helpers.

Legacy persisted sessions that contain `analysisResults` still load through
schema migration, but parsed and newly created chat sessions no longer include
that field.

## Related packages

- `@sqlrooms/ai` (recommended high-level integration)
- `@sqlrooms/ai-settings` (provider/model settings slice + UI)
- `@sqlrooms/ai-config` (config schemas and migrations)
