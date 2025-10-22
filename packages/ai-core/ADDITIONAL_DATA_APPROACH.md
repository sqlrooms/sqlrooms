# Additional Tool Output Data - Architecture & Approach

## The Problem

When tools execute, they often generate additional data (like detailed search results, charts, metadata) that needs to be sent to the client for UI rendering, but should NOT be included in the conversation history sent back to the LLM.

## Why We Use `data-tool-additional-output`

### AI SDK v5 Behavior

The Vercel AI SDK v5's `createUIMessageStream` API intentionally includes ALL data parts (including custom `data-` prefixed parts) in the UIMessage parts array. This is by design:

1. **Data parts are written to the stream**: When you use `writer.write({ type: 'data-toolOutput', ... })` in the backend
2. **They appear in TWO places**:
   - In the `onData` callback (✅ what we want - for storing tool additional data)
   - In the `messages[].parts` array (❌ pollutes the conversation history)

### Why Not Use Other Approaches?

#### ❌ Separate HTTP Endpoint
- Adds complexity with additional API routes
- Requires coordinating two separate requests
- Harder to maintain request/response correlation

#### ❌ Separate WebSocket/SSE Channel  
- Massive overkill for this use case
- Adds infrastructure complexity
- Requires separate connection management

#### ❌ Modify AI SDK Internals
- Would require forking the AI SDK
- Breaks with SDK updates
- Not maintainable

## Our Solution: Centralized Filtering

We filter out `data-tool-additional-output` parts at **three critical points**:

### 1. **During Active Streaming** (`useAiChat.ts`)
```typescript
// Filter messages returned by useChat
const filteredMessages = useMemo(() => filterDataParts(messages), [messages]);
```
**Why**: Removes data parts added during active streaming, before displaying to UI or saving to session.

### 2. **Before Sending to Backend** (`chatTransport.ts`)
```typescript
// In createRemoteChatTransportFactory
const filteredMessages = filterDataParts(parsed.messages || []);
```
**Why**: Prevents sending unnecessary data parts back to the LLM, keeping the context clean and reducing token usage.

### 3. **When Storing in Session** (`chatTransport.ts`)
```typescript
// In onChatFinish
const filteredMessages = filterDataParts(messages);
get().ai.setSessionUiMessages(currentSessionId, filteredMessages);
```
**Why**: Ensures the stored conversation history is clean and doesn't include data parts.

**Note**: We don't need to filter when reading from session storage because `setSessionUiMessages` is always called with already-filtered messages. The stored `uiMessages` are guaranteed to be clean.

## The Flow

```
Backend (route.ts)
  │
  ├─> Tool executes
  │   └─> writer.write({ type: 'data-tool-additional-output', ... })
  │
  ↓
Client receives stream
  │
  ├─> onData callback
  │   └─> setSessionToolAdditionalData() ✅ Stores in toolAdditionalData
  │
  └─> messages array (includes data parts) ❌ Needs filtering
      │
      ├─> [1] filterDataParts() during streaming (before UI/save)
      ├─> [2] filterDataParts() before sending to backend (LLM requests)
      └─> [3] filterDataParts() in onChatFinish (final storage)

Session Storage (always clean) → AI SDK → [1] Filter → UI Display
                                              ↓
                                      [3] Filter → Session Storage
                                      [2] Filter → Backend/LLM
```

## Benefits of This Approach

1. **✅ Clean Conversation History**: Data parts never pollute the LLM context
2. **✅ Efficient Token Usage**: Don't send unnecessary data to the LLM
3. **✅ Proper Data Storage**: Tool data is stored separately in `toolAdditionalData`
4. **✅ UI Flexibility**: Components can access tool data via `toolAdditionalData[toolCallId]`
5. **✅ Maintainable**: Single utility function (`filterDataParts`) handles all filtering
6. **✅ No Infrastructure Changes**: Works within existing AI SDK patterns
7. **✅ Simple & Trustworthy**: We only filter at write boundaries, trusting stored data is clean

## Why We Don't Need to Filter on Read

Since `setSessionUiMessages` is the **only** way to write to `session.uiMessages`, and it's **always** called with filtered messages, the stored data is guaranteed to be clean. This means:

```typescript
// ✅ Safe: session.uiMessages is always clean
useChat({ 
  messages: currentSession?.uiMessages ?? [] 
})
```

**How we maintain this guarantee:**
1. All writes go through `setSessionUiMessages`
2. Both call sites (`useAiChat.ts` and `chatTransport.ts`) filter before calling it
3. New sessions start with empty `uiMessages: []`
4. Migrations don't create data parts

This "filter at write boundaries" approach is simpler and more maintainable than defensive filtering on every read.

## Usage in Components

To access the additional tool data in your components:

```tsx
const currentSession = useRoomStore((state) => state.ai.getCurrentSession());
const toolData = currentSession?.toolAdditionalData?.[toolCallId];
```

## Alternative Considered: Message Annotations

AI SDK v5 supports message annotations, but these are still part of the message structure and would require similar filtering. The current approach is simpler and more explicit.

## Conclusion

While it may seem redundant to filter in multiple places, this is the **cleanest approach** given the AI SDK v5's architecture. The centralized `filterDataParts()` utility ensures:

- Consistent filtering logic
- Easy maintenance
- Clear separation between conversation data and tool rendering data
- No breaking changes to the AI SDK

