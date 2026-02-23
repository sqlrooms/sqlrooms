# @sqlrooms/ai-core

Core AI slice, chat UI primitives, and tool-streaming utilities for SQLRooms.

Use `@sqlrooms/ai-core` when you want lower-level control over AI state/transport/UI.  
For most apps, use the higher-level `@sqlrooms/ai` package.

## Installation

```bash
npm install @sqlrooms/ai-core @sqlrooms/room-store @sqlrooms/ui
```

## Store setup (core mode)

`createAiSlice` requires:

- `tools`
- `getInstructions`

```tsx
import {createAiSlice, type AiSliceState} from '@sqlrooms/ai-core';
import {
  BaseRoomStoreState,
  createBaseRoomSlice,
  createRoomStore,
} from '@sqlrooms/room-store';
import {z} from 'zod';

type State = BaseRoomStoreState & AiSliceState;

export const {roomStore, useRoomStore} = createRoomStore<State>(
  (set, get, store) => ({
    ...createBaseRoomSlice()(set, get, store),
    ...createAiSlice({
      getInstructions: () => 'You are a helpful analytics assistant.',
      tools: {
        echo: {
          name: 'echo',
          description: 'Echo text back',
          parameters: z.object({text: z.string()}),
          execute: async ({text}) => ({
            llmResult: {success: true, details: `Echo: ${text}`},
          }),
        },
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
      <Chat.Composer placeholder="Ask a question" />
    </Chat>
  );
}
```

## Useful exports

- Slice/hooks: `createAiSlice`, `useStoreWithAi`, `AiSliceState`
- Chat UI: `Chat`, `ModelSelector`, `QueryControls`, `PromptSuggestions`
- Legacy/compat components: `AnalysisResultsContainer`, `AnalysisResult`, `ErrorMessage`
- Tool/agent utilities:
  - `convertToAiSDKTools`
  - `cleanupPendingAnalysisResults`
  - `fixIncompleteToolCalls`
  - `processAgentStream`
  - `updateAgentToolCallData`

## Related packages

- `@sqlrooms/ai` (recommended high-level integration)
- `@sqlrooms/ai-settings` (provider/model settings slice + UI)
- `@sqlrooms/ai-config` (config schemas and migrations)
