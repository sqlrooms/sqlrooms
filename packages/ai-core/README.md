# @sqlrooms/ai

An AI integration package for SQLRooms that provides components and utilities for adding AI-powered features to your data applications. This package enables natural language querying, data analysis, and AI-assisted insights.

## Features

- 🤖 **AI Query Interface**: Natural language to SQL conversion
- 📊 **Automated Analysis**: AI-powered data analysis and insights
- 🔄 **State Management**: Zustand-based state management for AI features
- 🧩 **UI Components**: Ready-to-use components for AI interactions
- 📝 **Query History**: Track and manage AI query history
- 🎯 **Tool Integration**: Framework for AI tools and actions

## Installation

```bash
npm install @sqlrooms/ai
# or
yarn add @sqlrooms/ai
```

## Basic Usage

### Setting Up SqlRooms AI Chat for Browser-only application

```tsx
import {createAiSlice, createAiSettingsSlice} from '@sqlrooms/ai';
import {createRoomStore} from '@sqlrooms/room-shell';

// Create a room store with AI capabilities
const {roomStore, useRoomStore} = createRoomStore({
  // Base room configuration
  ...createRoomShellSlice({
    config: {
      // Your room configuration
    },
  }),
  // Ai model config slice
  ...createAiSettingsSlice({})(set, get, store),
  // Add AI slice
  ...createAiSlice({
    getInstructions: () => {
      return `You are an AI assistant that can answer questions and help with tasks.`;
    },
    initialAnalysisPrompt: 'What insights can you provide from my data?',
    tools: {
      // Your tools
    },
    getInstructions: () => {
      // add custom instructions here
      return createDefaultAiInstructions(store);
    },
  })(set, get, store),
});

function MyApp() {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <MyDataApp />
    </RoomStateProvider>
  );
}
```

### Setting Up SqlRooms AI Chat for Server-side application

## Architecture

### Dual Storage Pattern

The AI package uses a dual storage pattern to manage conversation data efficiently:

#### 1. `uiMessages` - Source of Truth (AI SDK v5)

The `uiMessages` array stores the complete, flat conversation history using the Vercel AI SDK v5 `UIMessage` format. This includes:

- User messages
- Assistant messages
- Tool call messages
- All message parts (text, tool invocations, etc.)

This is the **primary data structure** and serves as:

- The full context for AI model interactions
- The source for displaying conversation history
- The base for reconstructing analysis results

```tsx
// Example: Accessing UI messages
const currentSession = useRoomStore((state) => state.ai.getCurrentSession());
const messages = currentSession?.uiMessages || [];
```

#### 2. `analysisResults` - Derived & Error Storage

The `analysisResults` array is a **derived structure** that organizes messages into user prompt → AI response pairs. It primarily serves to:

- Store error messages that occur during analysis
- Provide backward compatibility with legacy data
- Offer a simplified view of analysis history

Analysis results are dynamically generated from `uiMessages` using the `transformMessagesToAnalysisResults` utility function.

```tsx
// Example: Getting analysis results (automatically derived from uiMessages)
const analysisResults = useRoomStore((state) => state.ai.getAnalysisResults());
```

#### 3. `toolAdditionalData` - Tool Output Storage

Each session also maintains a `toolAdditionalData` object that stores additional data from tool executions, keyed by `toolCallId`. This data is used for:

- Rendering tool-specific UI components
- Passing data between tool calls
- Preserving rich data that doesn't go back to the LLM

```tsx
// Example: Storing tool additional data
const setToolData = useRoomStore((state) => state.ai.setSessionToolAdditionalData);
setToolData(sessionId, toolCallId, {chartData: [...]});
```

## Data Structure

The basic data structure of the AI package is:

```ts
ai: {
  sessions: [
    {
      id: string,                    // CUID2 identifier
      name: string,                   // Session display name
      modelProvider: string,          // e.g., 'openai', 'anthropic'
      model: string,                  // e.g., 'gpt-4o', 'claude-3-5-sonnet'
      createdAt: Date,
      // Primary storage: Full conversation history (AI SDK v5 format)
      uiMessages: UIMessage[],
      // Secondary storage: Error messages and legacy compatibility
      analysisResults: AnalysisResult[],
      // Tool execution data
      toolAdditionalData: Record<string, unknown>,
    },
  ],
  currentSessionId: string,
}
```

### Session Schema

Each session contains:

#### `uiMessages` - Complete Chat History

Array of `UIMessage` objects from AI SDK v5, representing the full conversation:

```ts
type UIMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: UIMessagePart[];
};

type UIMessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool-invocation'; toolInvocation: {...} }
  | { type: 'tool-result'; toolResult: {...} };
```

#### `analysisResults` - Structured Analysis View

Array of `AnalysisResult` objects, derived from `uiMessages`:

```ts
type AnalysisResult = {
  id: string; // Matches the user message ID
  prompt: string; // User's question/request
  response: UIMessagePart[]; // (not used anymore) AI's response parts
  errorMessage?: {
    // Error if analysis failed
    error: string;
  };
  isCompleted: boolean; // Whether AI finished responding
};
```

#### `toolAdditionalData` - Rich Tool Outputs

Record mapping `toolCallId` to arbitrary data:

```ts
type ToolAdditionalData = Record<string, unknown>;

// Example:
{
  "call_abc123": {
    chartData: [...],
    metadata: {...}
  },
  "call_def456": {
    queryResults: [...]
  }
}
```

### Tool Execution Flow

1. User sends a prompt → creates a user `UIMessage`
2. AI processes and may call tools → creates assistant `UIMessage` with tool invocations
3. Tools execute and return:
   - `llmResult`: Text summary sent back to the LLM
   - `additionalData`: Rich data stored in `toolAdditionalData` for UI rendering
4. AI responds with final answer → creates assistant `UIMessage` with text
5. On completion: `uiMessages` updated, `analysisResult` created with user message ID

## Rendering

```text
|--------------------------------|
| AnalysisResultsContainer       |
|--------------------------------|
|  |--------------------------|  |
|  | AnalysisResult           |  |
|  |                          |  |
|  | ErrorMessage             |  |
|  | ------------             |  |
|  | UIMessage                |  |
|  |                          |  |
|  | |---------------------|  |  |
|  | | Parts               |  |  |
|  | |---------------------|  |  |
|  | | |---------------|   |  |  |
|  | | |TextPart       |   |  |  |
|  | | |---------------|   |  |  |
|  | | |ToolPart       |   |  |  |
|  | | |---------------|   |  |  |
|  | |    ...              |  |  |
|  | |---------------------|  |  |
|  |                          |  |
|  |--------------------------|  |
|--------------------------------|
```

## Tools

In AI package, we provide a OpenAssistantTool type that supports not only `execute` function, but also `context` object and `component` object:

- `execute` needs to return
  - llmResult: the result send back to LLM (no raw data)
  - additionalData: the data will be used by `component` and next `tool`
- `context`
  - provide e.g. runtime or async data for `execute`
  - `execute` can access `context` via `options.context`
- `component`
  - use `additionalData` to render a React component for this `tool`

For example, the `weather` tool is defined as follows:

```ts
const weatherTool: OpenAssistantTool = {
  name: 'weather',
  description: 'Get the weather in a city from a weather station',
  parameters: z.object({cityName: z.string()}),
  execute: async ({cityName}, options) => {
    const getStation = options.context?.getStation;
    const station = getStation ? await getStation(cityName) : null;
    return {
      llmResult: {
        success: true,
        details: `The weather in ${cityName} is sunny from weather station ${station}.`,
      },
      additionalData: {
        weather: 'sunny',
        station,
      },
    };
  },
  context: {
    getStation: async (cityName: string) => {
      const stations = {
        'New York': '123',
        'Los Angeles': '456',
        Chicago: '789',
      };
      return stations[cityName];
    },
  },
  component: WeatherStationComponent,
};
```

## Advanced Features

- **Custom AI Tools**: Define custom tools for AI to use with the tool() function
- **Multiple Sessions**: Create and manage multiple analysis sessions for different purposes
- **Model Selection**: Switch between different AI models and providers
- **Result Management**: Save, delete, and organize analysis results
- **Conversation Context**: Maintain context across multiple queries in a session
- **Feedback Loop**: Collect user feedback to improve AI responses

For more information, visit the SQLRooms documentation.
