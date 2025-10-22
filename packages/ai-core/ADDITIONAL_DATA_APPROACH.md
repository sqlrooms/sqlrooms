# Additional Tool Output Data - Architecture & Approach

## The Problem

When tools execute, they often generate additional data (like detailed search results, charts, metadata) that needs to be sent to the client for UI rendering, but should NOT be included in the conversation history sent back to the LLM.

## Our Solution: Using `transient: true`

The AI SDK v5 provides a built-in solution through the `transient` flag on data parts. When you write a data part with `transient: true`, the SDK automatically prevents it from being added to the message history.

### Backend Implementation (route.ts)

```typescript
writer.write({
  type: 'data-tool-additional-output',
  transient: true, // Won't be added to message history
  data: {
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    output: getToolAdditionalData(chunk.toolCallId),
    timestamp: new Date().toISOString(),
  },
});
```

**Key Benefits:**
- ✅ Data is sent via `onData` callback for UI rendering
- ✅ Automatically excluded from conversation history
- ✅ No manual filtering required
- ✅ Built-in SDK feature, not a workaround

## The Flow

```
Backend (route.ts)
  │
  ├─> Tool executes
  │   └─> writer.write({ 
  │         type: 'data-tool-additional-output',
  │         transient: true,  // ✅ SDK handles exclusion
  │         data: {...}
  │       })
  │
  ↓
Client receives stream
  │
  ├─> onData callback
  │   └─> setSessionToolAdditionalData() ✅ Stores in toolAdditionalData
  │
  └─> messages array ✅ Automatically excludes transient data parts

Session Storage (clean) → AI SDK → UI Display
                              ↓
                        Session Storage
                              ↓
                        Backend/LLM
```

## Benefits of This Approach

1. **✅ Clean Conversation History**: Transient data parts never appear in message history
2. **✅ Efficient Token Usage**: No unnecessary data sent to the LLM
3. **✅ Proper Data Storage**: Tool data is stored separately in `toolAdditionalData`
4. **✅ UI Flexibility**: Components can access tool data via `toolAdditionalData[toolCallId]`
5. **✅ Simple & Native**: Uses built-in SDK feature, no custom utilities needed
6. **✅ Maintainable**: Follows SDK conventions and patterns
7. **✅ No Manual Filtering**: SDK handles exclusion automatically

## Usage in Components

To access the additional tool data in your components:

```tsx
const currentSession = useRoomStore((state) => state.ai.getCurrentSession());
const toolData = currentSession?.toolAdditionalData?.[toolCallId];
```

## Why This is Better Than Manual Filtering

Previously, we manually filtered data parts at multiple points in the application. The `transient: true` flag eliminates this need by:

- Preventing data parts from entering message history at the source
- Reducing code complexity and maintenance burden
- Following official SDK patterns
- Providing cleaner, more maintainable code

## Alternative Considered: Message Annotations

AI SDK v5 supports message annotations, but these are still part of the message structure. The `transient` flag is specifically designed for data that should only be sent once and not persist in conversation history.

