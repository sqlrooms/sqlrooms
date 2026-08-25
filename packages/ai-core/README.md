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
- `getCustomModel` (optional) – returns a pre-constructed AI SDK `LanguageModel`, bypassing the OpenAI-compatible fallback entirely. Use this when a model is produced some other way, e.g. an app streaming through a server-side model proxy so no API key ever reaches the browser.

Send readiness (`ai.hasResolvableModel()`) reflects whichever of these paths can produce a model, so apps relying solely on `getCustomModel` do not need to register a phantom entry in `@sqlrooms/ai-settings`'s model list just to satisfy the composer's UI check. The predicate only checks that `getCustomModel` **was configured**; it never calls it.

Its counterpart `ai.requiresApiKey()` reports whether the path in effect needs a browser-held key at all — `false` when a `chatEndPoint` is configured (the remote transport sends server-side, so no key reaches the browser), and `false` when `getCustomModel` is configured **and currently returns a model**, since that model carries its own credentials. A configured factory returning `undefined` still needs a key, because the transport then falls back to the built-in OpenAI-compatible client. Unlike `hasResolvableModel()`, this predicate therefore invokes the factory: guessing optimistically about readiness only risks a failed send, but guessing optimistically about credentials hides the only UI for entering one. The result is cached per resolved provider/model pair — keyed, so returning to a previously selected model does not re-probe — meaning a mounted composer asks the factory once per distinct selection rather than once per store update. Keep it idempotent for a given selection. The composer's `needsApiKey` is gated on it, so an app behind a server-side proxy is never asked for a key it has no use for.

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

When no chat session exists, the composer and prompt suggestions share the
transient `ai.draftPrompt` value. `ai.setDraftPrompt()` can populate that draft,
and the first `ai.createSession()` transfers it to the new session.

Use `Chat.Composer`'s `topActions` slot for compact controls that should sit in
the prompt's top row, right-aligned beside context selectors.

> `<InlineApiKeyInput>` assumes session mode: it calls `useStoreWithAi`
> unconditionally, so passing it as a `Chat.Composer` child under
> `Chat.LocalAgentRoot` throws. Local-agent apps have no concept of a
> browser-held API key, so omit it there.

### Composable composer and prompt-suggestions primitives

`Chat.Composer` and `Chat.PromptSuggestions` are recipes: fully-styled,
opinionated defaults built on two lower layers that are themselves public API
for hosts that need a different visual shape.

**Layering**, thinnest to thickest:

1. **Behavior hooks** — `useChatComposer()` and `usePromptSuggestions()`. No
   DOM, no styling. Normalized state and actions that read identically
   whether the surrounding `Chat` is in session mode (`Chat.Root`) or
   local-agent mode (`Chat.LocalAgentRoot`).
2. **Unstyled primitives** — thin components built on the hooks above. All
   accept `asChild` (via Radix's `Slot`) to render as a single host-supplied
   child instead of their default DOM element, and none carry position,
   size, overflow, truncation, or other visual styling of their own.
3. **Recipes** — `Chat.Composer` and `Chat.PromptSuggestions`. SQLRooms' own
   opinionated, styled defaults, built entirely from the primitives above.
   Most apps only need these. Both supply their own state boundary, so they
   also work under a bare `RoomStateProvider` with no `<Chat>` ancestor —
   though as siblings that gives each its own state, so a shared pre-send
   policy needs a common ancestor (see below).

Reach for a lower layer only when a recipe's fixed appearance does not fit —
a host design system's own textarea, button, or list component, a
popover-anchored suggestions panel, or a horizontal carousel instead of the
vertical default.

`useChatComposer()` returns
`{mode, prompt, setPrompt, send, cancel, canSend, isRunning, isBusy, needsApiKey, sendBlocked}`.
Use it directly for anything that isn't textarea-shaped (a rich editor, a
custom input surface); `Input` below is built on it for the common textarea
case. It (and `ChatComposerStateBoundary`, for use outside any `<Chat>`
ancestor) is also how a suggestions list rendered elsewhere in the tree can
stay in sync with a composer mounted somewhere else.

Composer primitives (imported from `@sqlrooms/ai-core`, or via
`Chat.Composer.Input` / `.Send` / `.Stop` / `.DropTarget`):

- **`Input`** — binds the composer's prompt to a `<textarea>` (or, with
  `asChild`, a host-supplied one). Owns the Enter-to-send keymap (with an
  IME-composition guard and a no-modifiers check), optional auto-resize, and
  disables itself while busy. Host event handlers passed as props are
  merged, not replaced: the host's handler runs first, and calling
  `event.preventDefault()` suppresses this component's own behavior for that
  event — this is how `submitOnEnter` can be overridden by a host that wants
  full keymap control. Accepts a synchronous `onBeforeSend` pre-send veto
  (return `false` to abort a send).

  **The forwarded ref must reach the real DOM `<textarea>`.** With `asChild`,
  auto-resize measures and mutates inline `height` through the ref this
  component receives; if the host component that owns that ref does not
  forward it down to its own `<textarea>`, auto-resize silently does
  nothing — no error, and nothing a type check would catch.

- **`Send`** — sends the current prompt on activation. Renders nothing
  (`null`) while a run is in flight; disabled whenever `canSend` is `false`.
  Accepts the same synchronous `onBeforeSend` veto as `Input`.

  Both primitives render a `<button type="button">`, including under
  `asChild` — an untyped HTML button defaults to `submit`, which would post an
  enclosing host `<form>` and lose the draft. An `asChild` child that sets its
  own `type` keeps it.

- **`Stop`** — cancels the in-flight run on activation. Renders nothing while
  idle; never disabled once a run is in flight.
- **`DropTarget`** — marks an element as a drop target for in-app context
  items dragged into the composer (built on dnd-kit). **Handles in-app
  context items only, not file uploads** — dnd-kit observes pointer-driven
  drags between elements it manages, not native HTML5 file-drag events; a
  file drop needs a separate, native-drag-based primitive. **Requires
  `RoomDndProvider`**, not merely any dnd-kit `DndContext`: without a
  `DndContext` at all it throws rather than degrading to a no-op, and under a
  plain one it renders but never fires `onDrop`, because drops are accepted
  only for collisions carrying the `pointerWithin` marker that
  `RoomDndProvider`'s collision detector adds.

### Pre-send policy: `useRegisterBeforeSend`

`onBeforeSend` on `Input` and `Send` vetoes sends from _that control_. When the
policy belongs to the chat rather than to one button — "create an artifact
before the first message", "route this through my own session management" —
register it on the composer state instead:

```tsx
useRegisterBeforeSend(
  useCallback((text: string) => (isAllowed(text) ? undefined : false), []),
);
```

Every send routed through `useChatComposer()`'s `send` then consults it,
whatever triggered it — the composer's own controls, a prompt suggestion row, a
command. This is what `Chat.Composer`'s `onRun` prop is built on, and why
clicking a suggestion cannot bypass a veto the composer enforces. The handler
is synchronous; return `false` to abort.

The registry is **one per `<Chat>` root**, which is what gives it that reach.
Two `Chat.Composer`s under one root are two views of one chat — same session,
same prompt — so a policy registered by either applies to sends from both;
independent surfaces need their own root, and a duplicate `onRun` warns in
development rather than merging silently.

Sharing is by React ancestry, which has one consequence worth knowing when
using the recipes **standalone**. `Chat.Composer` and `Chat.PromptSuggestions`
each supply their own state boundary when no `<Chat>` is above them, so as
siblings under a bare `RoomStateProvider` they get _separate_ registries and a
suggestion click will not run the composer's `onRun`. Give them a common
`<Chat>` or `<ChatSuggestionsStateBoundary>` ancestor whenever the policy has
to span both — which is also what `<Chat>` does for you by default.

For a state that makes sending impossible outright rather than conditionally —
a missing credential, say — use `useBlockSends()` instead. It reports through
`useChatComposer()`'s `sendBlocked`, so `canSend` and suggestion rows render
disabled rather than looking live and doing nothing. `Chat.Composer` uses it
when it swaps to inline API-key entry.

`usePromptSuggestions()` returns
`{mode, visible, setVisible, toggle, items, isSessionEmpty, fill, send, isReadyToSend}`,
normalized the same way across both runtime modes. `send`/`isReadyToSend` reuse
the composer's own send action and readiness signals, so a suggestion and the
composer's send control can never disagree about whether sending is currently
possible — and any registered pre-send veto applies to both.

`isSessionEmpty` is true only when the chat has no messages _and_ no
in-progress prompt, counting a draft typed before any session exists. Branch on
it to show suggestions only on a genuinely empty chat.

Suggestions primitives:

- **`Root`** — visibility gate: renders nothing when suggestions are hidden,
  its child otherwise. Accepts an `open` override for hosts whose own
  popover, dropdown, or overlay already owns open/closed state; pair it with
  `onOpenChange`, since while controlled the `VisibilityToggle` and `Dismiss`
  controls _inside_ this root report through that callback instead of writing
  the store `open` overrides. Controls rendered outside a controlled root keep
  targeting the store, so controlling one list does not retarget unrelated
  toggles.
- **`Item`** — a single suggestion. Fills the prompt on activation by
  default; pass `submit` to send immediately instead. Disabled whenever
  `isReadyToSend` is `false`.
- **`VisibilityToggle`** — toggles visibility; exposes `aria-pressed` for
  styling pressed/unpressed. Inside a controlled `Root` it writes through
  `onOpenChange` rather than the overridden store, but since such a root
  renders nothing while hidden it can only close from there — render it
  outside the root for a control that also re-opens.
- **`Dismiss`** — hides suggestions unconditionally (unlike
  `VisibilityToggle`, it never re-shows them).

`useControlledVisibility()` returns the nearest controlled `Root`'s
`{visible, setVisible}`, or `null` when visibility is owned by the normalized
store. A host writing its own visibility control needs it: writing
`usePromptSuggestions().setVisible(false)` directly has no effect inside a
controlled root, whose `open` overrides the store. Prefer the controlled state
when it is present and fall back to the store otherwise, which is what
`Dismiss` and `VisibilityToggle` do.

None of the suggestions primitives carry position, size, overflow,
truncation, or tooltip styling — a host's own vertical list, popover, or
horizontal scroller owns all of that. `examples/ai-rag` builds a horizontal
carousel directly from these primitives (composed with `@sqlrooms/ui`'s
`ScrollableRow`) — it stays in the repo specifically to prove the primitives
impose no layout of their own, alongside `examples/ai`'s use of the vertical
recipe.

#### Breaking changes in this release

- **Local-agent `Enter` while streaming no longer stops the run.** It is now
  a no-op, matching session mode: `Enter` sends when ready, and never
  cancels a run in flight.
- **`Chat.PromptSuggestions` now defaults to a full-width vertical list**
  with click-to-send and CSS-ellipsis truncation (plus a native `title` for
  the full text), replacing the previous horizontal card carousel that
  filled the prompt for editing and truncated by character count. A
  horizontal layout is still available — build it from the suggestions
  primitives, as `examples/ai-rag` does.

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
| `ActiveStatus`  | Current in-flight run status and elapsed-time presentation    |
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

You can combine any of these in one `components` map by providing both the
`Prompt` and `Reasoning` entries.

**Active run status** — change or suppress the progress indicator without
reimplementing chat-run state derivation. The exported `getChatActiveStatus`
helper is also available when the indicator needs to be placed outside
`Chat.Messages`:

```tsx
import {Chat, type ChatActiveStatusProps} from '@sqlrooms/ai-core';

function AppActiveStatus({status}: ChatActiveStatusProps) {
  return <MyProgressIndicator label={status.label} />;
}

<Chat.Rendering components={{ActiveStatus: AppActiveStatus}}>
  <Chat.Messages />
</Chat.Rendering>;
```

Set `ActiveStatus` to a component that returns `null` when the host owns the
indicator's placement entirely. For that case, call `getChatActiveStatus` with
the current messages and `ToolRenderBehavior` to reuse the same status model.

`TextOutput` receives `isAnswer=true` only for text that is the final message
part. Planning text followed by tool activity remains regular response text.

**Tool activity** — customize top-level and nested tool or agent rows through
one normalized contract. `toolCall` is always present; `part` is only present
when the activity originated from a top-level AI SDK message part:

```tsx
import {Chat, type ChatToolActivityProps} from '@sqlrooms/ai-core';

function AppToolActivity({toolCall, isAgent}: ChatToolActivityProps) {
  return (
    <div data-state={toolCall.state}>
      {isAgent ? 'Agent' : 'Tool'}: {toolCall.toolName}
    </div>
  );
}

<Chat.Rendering components={{ToolActivity: AppToolActivity}}>
  <Chat.Messages />
</Chat.Rendering>;
```

The same recipe also applies inside nested agents. Similarly, an `Activity`
override controls their activity chrome when `nestedActivityMode="own-boxes"`.
For agent rows, `toolCall.agentToolCalls` follows live agent progress and then
the persisted final output, so the same renderer works during streaming.

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

### Optional timeout safety limits

Chat and tool timeouts are disabled by default. Apps can opt into a generous
run limit, an idle-stream watchdog, and tool execution limits through
`createAiSlice`. Timeout options are runtime behavior and are not persisted in
workspace configuration.

```ts
createAiSlice({
  tools,
  getInstructions,
  // Hybrid tools that omit `execute` on the configured remote endpoint.
  remoteClientToolNames: ['weather'],
  timeouts: {
    runMs: 30 * 60_000,
    idleStreamMs: 5 * 60_000,
    toolExecutionMs: 5 * 60_000,
    tools: {
      query: undefined, // Allow long-running queries.
      fetchMetadata: 30_000,
    },
  },
});
```

`runMs` covers the complete multi-step run. `idleStreamMs` resets when the UI
receives observable message progress and pauses while waiting for tool
approval. A silent operation that is still working is indistinguishable from a
stalled operation, so idle timeouts should remain conservative. Tool timeouts
abort the signal passed to the tool and fail its pending call; tools should
honor `abortSignal` to stop their underlying work promptly. Local executable
tools and registered tools awaiting client output are covered, including hybrid
client tools named by `remoteClientToolNames` whose remote definition omits
`execute`. Remote endpoints remain responsible for enforcing timeouts around
tools they execute server-side.

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

## Chat runtime providers

`Chat.Root` and `Chat.LocalAgentRoot` render one of two runtime providers that
the `Chat` message and composer components read via `useChatRuntime()`:

- `SessionChatRuntimeProvider` — the default. Selects the **session** runtime, so
  the UI is driven by the session-backed AI slice (`Chat.Root` wraps this).
- `LocalAgentChatRuntimeProvider` — selects the **local-agent** runtime, driving
  the same UI from a pre-constructed `ToolLoopAgent` with its own local message
  state (`Chat.LocalAgentRoot` wraps this). It takes the same props as
  `Chat.LocalAgentRoot` (`agent`, `initialMessages`, `initialSuggestions`,
  `onMessagesChange`).

The two are mutually exclusive modes, not layers: a `Chat` subtree is wrapped by
exactly one of them. Most apps use `Chat.Root` / `Chat.LocalAgentRoot` and never
touch these directly; they are exported for advanced setups that compose the
runtime themselves. Both must wrap the `Chat` components that call
`useChatRuntime()`; used outside a provider, the runtime defaults to session mode.

Session chat execution itself is owned by the AI slice, independently of these
presentation providers. `startAnalysis(sessionId)` lazily creates an ephemeral
chat runtime for the session, so a run can continue when no React chat surface is
mounted. `useSessionChat(sessionId)` only subscribes React to the runtime's chat.
Persisted messages and session state remain in `ai.config`, while SDK chat
instances, subscriptions, and timers remain ephemeral.

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

### Provider-context diagnostics

Provider-context capture is also opt-in. Enable it when creating the AI slice;
records are kept in memory and the oldest record is discarded when the limit
is exceeded (the default limit is `100`):

```ts
createAiSlice({
  tools,
  getInstructions,
  devtools: {
    captureProviderContexts: true,
    maxProviderContextRecords: 100,
  },
});

const providerContexts = useRoomStore(
  (state) => state.ai.devtools.providerContexts,
);
roomStore.getState().ai.devtools.clearProviderContexts();
```

Each `ProviderContextDiagnostic` describes one provider step using metadata
only: role, provider/model, session and step identifiers, instruction/message
sizes, tool names and schema sizes, source labels, optional preparation
metrics, and provider-reported input tokens when available. Raw instructions,
messages, and tool schemas are not copied into the record. The records are
transient devtools state and are also shown by `ChatSessionDebugView`.

Core chat and `ai.sendPrompt()` provider steps are captured automatically when
the option is enabled. Custom or nested agents can use
`state.ai.devtools.measureProviderContext(input)` to measure and append the same
record shape while respecting the capture flag. The main package also exports
`measureProviderContext`, `tryMeasureProviderContext`,
`MeasureProviderContextArgs`, and `ProviderContextDiagnostic` for integrations
that need to measure outside a slice method. `measureProviderContext` is the
strict helper and rejects measurement failures; `tryMeasureProviderContext` is
the fail-open request-path helper that logs a warning and returns `undefined`
so diagnostics cannot abort a valid provider request. Callers using either
standalone helper are responsible for writing the returned record to their
chosen diagnostics store.

## Useful exports

- Slice/hooks: `createAiSlice`, `useStoreWithAi`, `generateSessionTitle`, `useGenerateSessionTitle`, `AiSliceState`
- Chat UI: `Chat`, `ChatMessagesContainer`, `ChatTurnView`, `MessageContent`, `ModelSelector`, `QueryControls`, `PromptSuggestions`
- Block Ask AI: `BlockAiPromptPopover`, `createAskAiBlockHeaderAction`, `AskAiBlockHeaderActionRenderContext`, `CreateAskAiBlockHeaderActionOptions`
- Devtools subexport: `@sqlrooms/ai-core/devtools`
- Legacy/compat components: `AnalysisResultsContainer`, `AnalysisResult`, `AnalysisAnswer`, `ErrorMessage`
- Session helpers: `ChatSessionSchema`, `isChatSessionEmpty`, `getChatTurnsFromUiMessages`
- Forking: `ai.forkSessionFromMessage()`, `AiSessionForkOrigin`, `ForkSessionFromMessageArgs`
- Types: `ChatTurn`, `ToolRendererProps`, `ToolRenderer`, `ToolRendererRegistry`, `StoredTool`, `StoredToolSet`
- Provider diagnostics: `measureProviderContext`, `tryMeasureProviderContext`, `MeasureProviderContextArgs`, `ProviderContextDiagnostic`
- Tool/agent utilities:
  - `cleanupPendingUiMessages`
  - `cleanupPendingAnalysisResults`
  - `fixIncompleteToolCalls`
  - `streamSubAgent`
  - `withRunContextTools`

### Forwarding execution scope into nested agents

Top-level tools receive the invoking turn's `sessionId` and `AiRunContext`
because the chat transport wraps `state.ai.tools` with `withRunContextTools`.
Tools handed to a nested `ToolLoopAgent` are not wrapped by the transport, so
without the same wrapper they execute with no scope and any target resolution
that defaults to "the current artifact/map" silently follows mutable UI
selection instead of the artifact captured when the prompt was submitted.

Wrap nested toolsets with the parent's execution options:

```ts
import {withRunContextTools} from '@sqlrooms/ai-core';

const nestedTool = tool({
  inputSchema,
  execute: async (input, options) => {
    const agent = new ToolLoopAgent({
      model,
      instructions,
      // `options` carries the parent turn's scope; forward it verbatim.
      tools: withRunContextTools(
        nestedTools,
        options as AiToolExecutionContext,
      ),
    });
    return streamSubAgent(
      agent,
      prompt,
      store,
      options.toolCallId,
      // The wrapper preserves `abortSignal` for the nested tools, but the
      // sub-agent loop itself only observes cancellation through this argument.
      options.abortSignal,
    );
  },
});
```

Forward `options.abortSignal` to `streamSubAgent`. `withRunContextTools` leaves
the signal intact for the tools the sub-agent calls, but the agent loop —
including the model stream and any approval wait — is only cancellable through
`streamSubAgent`'s fifth argument, so omitting it lets a stopped parent turn
leave the nested run going.

Pass the parent's `getAiRunContext` (not a copied `aiRunContext`) so an in-turn
retarget via `set_primary_context_artifact` is visible to subsequent nested tool
calls. Parent scope wins over inner options, so a nested agent cannot reassign
the owning session; fields the parent leaves `undefined` are preserved.

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
