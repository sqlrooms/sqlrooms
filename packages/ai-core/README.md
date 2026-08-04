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
      <Chat.Composer
        placeholder="Ask a question"
        topActions={<Chat.PromptSuggestions.VisibilityToggle />}
      />
    </Chat>
  );
}
```

Use `Chat.Composer`'s `topActions` slot for compact controls that should sit in
the prompt's top row, right-aligned beside context selectors.

### Customizable chat presentation

SQLRooms owns the **semantic model** for each turn (activity, status, reasoning,
outputs, timing, nesting, chronological grouping, hoist eligibility). Host apps
optionally own **presentation** (layout, disclosure, labels, styling, visibility)
through `Chat.Rendering`.

Most apps keep the polished default recipe and only need `<Chat.Messages />`.
Missing slots always inherit SQLRooms defaults; nested providers merge rather
than replace the parent recipe.

#### How `<Chat.Messages />` uses the slots

`<Chat.Messages />` is the session list surface: it derives chat turns from the
current session's `uiMessages` and renders one `ChatTurnView` per turn. It does
**not** own chrome for prompts, reasoning, tools, or answers.

Each `ChatTurnView` builds the turn's semantic model (what happened, in what
order, what is hoistable / running / completed), then asks the nearest
`Chat.Rendering` recipe to present it. The recipe is a map of slot components:

| Slot            | Role                                                          |
| --------------- | ------------------------------------------------------------- |
| `Turn`          | Full turn layout recipe — composes pre-wired semantic regions |
| `Prompt`        | User prompt chrome for the turn                               |
| `Activity`      | Collapsible / status chrome around in-progress work           |
| `Reasoning`     | Model thinking / reasoning disclosure                         |
| `ToolActivity`  | One tool (or nested agent) line inside Activity               |
| `TextOutput`    | Assistant text / markdown answer regions                      |
| `HoistedOutput` | Rich tool UI lifted out of the activity stream                |
| `Error`         | Turn-level error feedback                                     |
| `Actions`       | Available per-turn operations such as copy and fork           |

Composition looks like this:

```text
Chat
└─ Chat.Rendering          ← optional; supplies / merges slot components
   └─ Chat.Messages        ← lists turns from the session
      └─ ChatTurnView      ← builds semantic model, then renders Turn
         └─ Turn           ← composes pre-wired regions
            ├─ Prompt
            ├─ Timeline    ← default source-order body
            ├─ Activity    ← aggregated activity for custom layouts
            ├─ Response / Summary
            ├─ HoistedOutputs
            ├─ Error
            └─ Actions
```

So:

- Wrap `<Chat.Messages />` in `<Chat.Rendering>` to change presentation for that
  subtree (or nest providers to layer overrides).
- Override leaf slots (`Prompt`, `Reasoning`, …) when you only need different
  look for those regions; `Turn` keeps deciding where they appear.
- Override `Turn` when the regional structure itself must change. It receives
  pre-wired region components, so it can reorder or omit regions without
  rebuilding search ids, tool classification, or leaf-slot props.

Without a `Chat.Rendering` ancestor, `ChatTurnView` uses the built-in SQLRooms
defaults for every slot.

#### Override a single slot

Pass a partial `components` map. Only the slots you provide change; everything
else keeps the SQLRooms (or parent) recipe.

**Activity chrome only** — keep default turn order and prompt/reasoning look:

```tsx
import {Chat, type ChatActivityProps} from '@sqlrooms/ai-core';

function AppActivity({children, isRunning, summaryLabel}: ChatActivityProps) {
  return (
    <section data-running={isRunning}>
      {summaryLabel ? <header>{summaryLabel}</header> : null}
      {children}
    </section>
  );
}

export function AiPanel() {
  return (
    <Chat>
      <Chat.Rendering components={{Activity: AppActivity}}>
        <Chat.Messages />
      </Chat.Rendering>
    </Chat>
  );
}
```

**Prompt look only** — restyle the user message bubble without touching turn
layout or tool activity:

```tsx
import {Chat, type ChatPromptProps} from '@sqlrooms/ai-core';

function AppPrompt({prompt, searchBlockId}: ChatPromptProps) {
  return (
    <blockquote data-search-block={searchBlockId} className="border-l-2 pl-3">
      {prompt}
    </blockquote>
  );
}

<Chat.Rendering components={{Prompt: AppPrompt}}>
  <Chat.Messages />
</Chat.Rendering>;
```

**Reasoning look only** — change thinking disclosure while keeping default
activity boxes and answer rendering:

```tsx
import {Chat, type ChatReasoningProps} from '@sqlrooms/ai-core';

function AppReasoning({text, isRunning}: ChatReasoningProps) {
  return (
    <aside aria-busy={isRunning}>
      <strong>{isRunning ? 'Thinking…' : 'Thoughts'}</strong>
      <pre>{text}</pre>
    </aside>
  );
}

<Chat.Rendering components={{Reasoning: AppReasoning}}>
  <Chat.Messages />
</Chat.Rendering>;
```

You can combine any of these in one map, e.g.
`components={{Prompt: AppPrompt, Reasoning: AppReasoning}}`.

**Action controls** — compose available operations without recreating their
behavior. Optional `copy` and `fork` objects are capabilities: omitting one
hides it, while its `Content` keeps the built-in control wired correctly:

```tsx
import {Chat, type ChatActionsProps} from '@sqlrooms/ai-core';

function AppActions({copy}: ChatActionsProps) {
  const Copy = copy?.Content;
  return (
    <div className="flex gap-1">
      {Copy && <Copy />}
      <MyCustomButton />
    </div>
  );
}

<Chat.Rendering components={{Actions: AppActions}}>
  <Chat.Messages />
</Chat.Rendering>;
```

Apps can replace a control's visuals while preserving its behavior:

```tsx
function AppActions({fork}: ChatActionsProps) {
  return fork ? <MyForkButton onClick={fork.run} /> : null;
}
```

An absent capability cannot be enabled accidentally: `fork` is only present
when the turn can actually be forked.

#### Fully custom turn layout

Override `Turn` when you need a different regional order or structure (for
example activity → response → hoisted → summary). Pair with
`nestedActivityMode="embed"` when nested agents should contribute log lines
into the parent Activity instead of creating their own boxes. Each region
exposes semantic data and a pre-wired `Content` component, so custom layouts
can inspect status and items without rebuilding search, tool, or hoist wiring:

```tsx
import {Chat, type ChatTurnSlotProps} from '@sqlrooms/ai-core';

function AppChatTurn({turn}: ChatTurnSlotProps) {
  const Prompt = turn.prompt.Content;
  const Activity = turn.activity.Content;
  const Response = turn.response.Content;
  const HoistedOutputs = turn.hoistedOutputs.Content;
  const Summary = turn.summary.Content;
  const Error = turn.error?.Content;
  const Actions = turn.actions.Content;

  return (
    <article data-turn-id={turn.id} aria-busy={!turn.isCompleted}>
      <Prompt />
      <Activity />
      <Response />
      <HoistedOutputs />
      <Summary />
      {Error && <Error />}
      <Actions />
    </article>
  );
}

<Chat.Rendering
  nestedActivityMode="embed"
  components={{Turn: AppChatTurn, Prompt: AppPrompt, Reasoning: AppReasoning}}
>
  <Chat.Messages />
</Chat.Rendering>;
```

Errors are deliberately separate from actions in the turn model. The default
layout keeps them adjacent, but a custom `Turn` may place or omit each region
independently.

Activity and hoisted-output regions are also disjoint: nested agent activity
contains status/log presentation, while nested rich outputs are rendered once
through `turn.hoistedOutputs` in decomposed layouts. The pre-wired `Timeline`
keeps owning both when the default source-order layout is used.

For finer composition, iterate semantic items and render their pre-wired leaf
components. Tool items expose state, agent, and hoist metadata:

```tsx
function AppActivity({turn}: ChatTurnSlotProps) {
  return turn.activity.items.map((item) => {
    const Content = item.Content;
    return (
      <section
        key={item.id}
        data-state={item.kind === 'tool' ? item.state : undefined}
      >
        <Content />
      </section>
    );
  });
}
```

Pair a custom `Turn` with leaf-slot overrides as needed. Prefer keeping the
default turn (or a host-owned turn recipe) and swapping only the slots that
must differ, unless the regional order itself has to change.

`Chat.Header` and `Chat.History` can delegate session creation to the host app
with `onCreateSession`. `Chat.History` also accepts `filterSession` and
`emptyLabel` so apps can present scoped histories without changing the generic
AI session schema.

`createAiSlice({onChatFinish})` lets host apps observe a non-aborted turn after
the completed messages have been persisted and the analysis has ended. Use this
for app-owned follow-up behavior, such as forking a completed chat into a new
workspace target, while keeping the generic AI slice unaware of app-specific
state.

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

## Devtools

`@sqlrooms/ai-core/devtools` exposes development-only inspection helpers and UI
for session debugging without adding the debug surface to the main
`@sqlrooms/ai-core` barrel.

```tsx
import {ChatSessionDebugView} from '@sqlrooms/ai-core/devtools';

function DebugPanel({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose?: () => void;
}) {
  return <ChatSessionDebugView sessionId={sessionId} onClose={onClose} />;
}
```

`ChatSessionDebugView` reads the current AI store context and renders a tabbed
debug view for one chat session: the chronological timeline, registered tools,
run context, raw session JSON, model settings, tool calls, nested agent work,
and optional agent snapshots.

Agent snapshot capture is opt-in on `createAiSlice`:

```ts
createAiSlice({
  tools,
  getInstructions,
  devtools: {
    captureAgentSnapshots: true,
    persistAgentSnapshots: true,
    maxAgentSnapshotBytes: 64_000,
  },
});
```

Snapshots are bounded serializable metadata only: agent/tool names,
descriptions, capability flags, approval hints, and settings. They must not
store executable tools, closures, secrets, or unbounded prompt/output content.
Persist snapshots only for debugging workflows where cross-tab or post-mortem
inspection is useful.

Captured snapshots and snapshot controls live under the AI state's devtools
namespace:

```ts
const snapshots = useRoomStore((state) => state.ai.devtools.agentSnapshots);
state.ai.devtools.clearAgentSnapshots();
```

## Useful exports

- Slice/hooks: `createAiSlice`, `useStoreWithAi`, `generateSessionTitle`, `useGenerateSessionTitle`, `AiSliceState`
- Chat UI: `Chat`, `ChatMessagesContainer`, `ChatTurnView`, `MessageContent`, `ModelSelector`, `QueryControls`, `PromptSuggestions`
- Block Ask AI: `BlockAiPromptPopover`, `createAskAiBlockHeaderAction`, `AskAiBlockHeaderActionRenderContext`, `CreateAskAiBlockHeaderActionOptions`
- Devtools subexport: `@sqlrooms/ai-core/devtools`
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
