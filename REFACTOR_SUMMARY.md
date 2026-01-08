# AI-Core Per-Session Chat Refactoring Summary

## Overview

This refactoring transforms the ai-core package from using a single global `useChat` instance to supporting independent per-session chat instances. This allows multiple sessions to have concurrent, independent chat streams without interfering with each other.

## Key Changes

### 1. Schema Updates (`packages/ai-config/src/schema/AnalysisSessionSchema.ts`)

Added per-session state fields to `AnalysisSessionSchema`:
- `analysisPrompt: string` - Each session has its own prompt text
- `isRunningAnalysis: boolean` - Each session tracks its own running state

### 2. New Hook: `useSessionChat` (`packages/ai-core/src/hooks/useSessionChat.ts`)

Created a new hook that manages a `useChat` instance for a specific session:
- Takes a `sessionId` parameter
- Returns `{messages, sendMessage, stop, status, sessionId}`
- Each invocation creates an independent chat instance
- Encodes the session into `useChat({ id })` as `${sessionId}::${messagesRevision}` so transports/handlers can safely resolve the owning session even if the user switches sessions mid-stream

### 3. New Components

**SessionChatProvider** (`packages/ai-core/src/components/SessionChatProvider.tsx`):
- Wraps `useSessionChat` for a specific session
- Manages the lifecycle of a session's chat instance

**SessionChatManager** (`packages/ai-core/src/components/SessionChatManager.tsx`):
- Renders a `SessionChatProvider` for each session
- Ensures all sessions have active chat instances
- Mounts providers for the current session **and** any sessions with `isRunningAnalysis === true` to keep streaming + stop/cancel session-correct when switching between sessions
- Should be placed once at the application root

### 4. AiSlice Refactoring (`packages/ai-core/src/AiSlice.ts`)

**Removed Global State**:
- ❌ `analysisPrompt: string`
- ❌ `isRunningAnalysis: boolean`
- ❌ `analysisAbortController?: AbortController`
- ❌ `chatStop?: () => void`
- ❌ `chatSendMessage?: ((message: {text: string}) => void)`
- ❌ `addToolResult?: AddToolResult`

**Added Per-Session State Management**:
- ✅ `sessionAbortControllers: Map<string, AbortController>`
- ✅ `sessionChatStops: Map<string, () => void>`
- ✅ `sessionChatSendMessages: Map<string, (message: {text: string}) => void>`
- ✅ `sessionAddToolResults: Map<string, AddToolResult>`

**New Methods**:
- `getAbortController(sessionId)`
- `setAbortController(sessionId, controller)`
- `getChatStop(sessionId)`
- `setChatStop(sessionId, stop)`
- `getChatSendMessage(sessionId)`
- `setChatSendMessage(sessionId, sendMessage)`
- `getAddToolResult(sessionId)`
- `setAddToolResult(sessionId, addToolResult)`
- `getPrompt(sessionId)`
- `setPrompt(sessionId, prompt)`
- `getIsRunningAnalysis(sessionId)`
- `setIsRunningAnalysis(sessionId, isRunning)`

**Updated Methods**:
- `startAnalysis(sessionId)` - Now takes sessionId instead of sendMessage
- `cancelAnalysis(sessionId)` - Now takes sessionId parameter
- `deleteSession(sessionId)` - Now cleans up per-session resources

### 5. Component Updates

**QueryControls** (`packages/ai-core/src/components/QueryControls.tsx`):
- Now reads/writes per-session prompt using `getPrompt` and `setPrompt`
- Passes `sessionId` to `startAnalysis` and `cancelAnalysis`

**AnalysisResultsContainer** (`packages/ai-core/src/components/AnalysisResultsContainer.tsx`):
- Now uses `getIsRunningAnalysis(sessionId)` instead of global state

**PromptSuggestions** (`packages/ai-core/src/components/PromptSuggestions.tsx`):
- Updated to use `setPrompt(sessionId, text)`

### 6. Chat Transport Updates (`packages/ai-core/src/chatTransport.ts`)

Updated all chat handlers to use per-session state:
- `onChatToolCall` - Uses session-specific abort controller
- `onChatFinish` - Updates session-specific running state
- `onChatError` - Cleans up session-specific resources
- `createLocalChatTransportFactory` - Uses session-specific abort signal
- `toolCallId -> sessionId` routing - Lets long-running tool streams resolve the correct session even if the user navigates away
- `waitForToolResult(sessionId, toolCallId, ...)` - Waits for UI tool results in a session-scoped way to avoid cross-session tool result collisions

### 7. Type Updates (`packages/ai-core/src/types.ts`)

Updated `AiStateForTransport` interface to reflect new per-session methods:
- Added `getAbortController(sessionId)`
- Added `setAbortController(sessionId, controller)`
- Added `getIsRunningAnalysis(sessionId)`
- Added `setIsRunningAnalysis(sessionId, isRunning)`
- Removed global `analysisAbortController`, `isRunningAnalysis`, `analysisPrompt`

## Usage

### In Your Application Root

Add the `SessionChatManager` component once at the root level:

```tsx
import {SessionChatManager} from '@sqlrooms/ai';

export const App = () => {
  return (
    <div>
      <SessionChatManager />
      {/* Rest of your app */}
    </div>
  );
};
```

### Example: Multiple Independent Sessions

```tsx
// Session A
const sessionA = store.ai.config.sessions[0];
store.ai.setPrompt(sessionA.id, "What is the average price?");
store.ai.startAnalysis(sessionA.id);

// Session B (can be started while A is still running)
const sessionB = store.ai.config.sessions[1];
store.ai.setPrompt(sessionB.id, "Show me the top 10 products");
store.ai.startAnalysis(sessionB.id);

// Cancel session A without affecting session B
store.ai.cancelAnalysis(sessionA.id);
```

## Benefits

1. **Independent Streaming**: Each session can stream responses independently
2. **No State Conflicts**: Switching sessions doesn't interrupt ongoing streams
3. **Parallel Analysis**: Multiple sessions can run analysis simultaneously
4. **Clean State Management**: Session-specific state is properly isolated
5. **Resource Cleanup**: Deleting a session cleans up its chat resources

## Migration Guide

If you have custom code that uses the old global state:

### Before
```typescript
const analysisPrompt = useStoreWithAi(s => s.ai.analysisPrompt);
const isRunning = useStoreWithAi(s => s.ai.isRunningAnalysis);
store.ai.startAnalysis(sendMessage);
```

### After
```typescript
const currentSession = useStoreWithAi(s => s.ai.getCurrentSession());
const sessionId = currentSession?.id;
const analysisPrompt = useStoreWithAi(s =>
  sessionId ? s.ai.getPrompt(sessionId) : ''
);
const isRunning = useStoreWithAi(s =>
  sessionId ? s.ai.getIsRunningAnalysis(sessionId) : false
);
store.ai.startAnalysis(sessionId);
```

## Files Modified

- `packages/ai-config/src/schema/AnalysisSessionSchema.ts`
- `packages/ai-config/src/AiSliceConfig.ts`
- `packages/ai-core/src/AiSlice.ts`
- `packages/ai-core/src/types.ts`
- `packages/ai-core/src/hooks/useSessionChat.ts` (new)
- `packages/ai-core/src/components/SessionChatProvider.tsx` (new)
- `packages/ai-core/src/components/SessionChatManager.tsx` (new)
- `packages/ai-core/src/components/QueryControls.tsx`
- `packages/ai-core/src/components/AnalysisResultsContainer.tsx`
- `packages/ai-core/src/components/PromptSuggestions.tsx`
- `packages/ai-core/src/chatTransport.ts`
- `packages/ai-core/src/index.ts`
- `examples/ai/src/components/MainView.tsx`

## Backward Compatibility

The old `useAiChat` hook still exists but should not be used for new code. It will be deprecated in a future version. Use `useSessionChat` instead for new implementations.

