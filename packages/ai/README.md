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

Since version 0.8.2, you will need to install the LLM providers you want to use. For example, to use OpenAI, you can install the `@ai-sdk/openai` package:

```bash
npm install @ai-sdk/openai
```

Google LLM provider:

```bash
npm install @ai-sdk/google
```

Anthropic LLM provider:

```bash
npm install @ai-sdk/anthropic
```

DeepSeek LLM provider:

```bash
npm install @ai-sdk/deepseek
```

XAI LLM provider:

```bash
npm install @ai-sdk/xai
```

ollama LLM provider:

```bash
npm install ollama-ai-provider
```

## Basic Usage

### Setting Up AI Integration

```tsx
import {createAiSlice, createDefaultAiConfig} from '@sqlrooms/ai';
import {createRoomStore} from '@sqlrooms/room-shell';

// Create a room store with AI capabilities
const {roomStore, useRoomStore} = createRoomStore({
  // Base room configuration
  ...createRoomSlice({
    config: {
      // Your room configuration
      ...createDefaultAiConfig(), // Default AI configuration
    },
  }),
  // Add AI slice
  ...createAiSlice({
    getApiKey: (modelProvider) => {
      // Return API key for the specified model provider
      return process.env.OPENAI_API_KEY || '';
    },
    initialAnalysisPrompt: 'What insights can you provide from my data?',
    // Optional: Add custom tools
    customTools: {
      // Your custom tools
    },
    // Optional: Custom instructions for the AI
    getInstructions: (tablesSchema) => {
      return `Analyze the following tables: ${tablesSchema.map((t) => t.name).join(', ')}`;
    },
  }),
});

function MyApp() {
  return (
    <RoomStateProvider roomStore={roomStore}>
      <MyDataApp />
    </RoomStateProvider>
  );
}
```

### Advanced Store Configuration

For more complex applications, you can combine multiple slices:

```tsx
import {
  createAiSlice,
  createDefaultAiConfig,
  AiSliceConfig,
} from '@sqlrooms/ai';
import {
  createSqlEditorSlice,
  createDefaultSqlEditorConfig,
} from '@sqlrooms/sql-editor';
import {createRoomStore, createRoomSlice} from '@sqlrooms/room-shell';

// Define your application state type
export type RoomState = RoomState<RoomConfig> &
  AiSliceState &
  SqlEditorSliceState;

// Create the store with multiple slices
export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  (set, get, store) => ({
    // Base room slice
    ...createRoomSlice({
      config: {
        // Your base configuration
        ...createDefaultAiConfig({
          // Optional: Pre-configured AI sessions
          sessions: [
            {
              id: 'default-session',
              name: 'Default Analysis',
              modelProvider: 'openai',
              model: 'gpt-4o',
              analysisResults: [],
              createdAt: new Date(),
            },
          ],
          currentSessionId: 'default-session',
        }),
        ...createDefaultSqlEditorConfig(),
      },
    }),
    // AI slice
    ...createAiSlice({
      getApiKey: (modelProvider) => {
        // Return API key based on provider
        return apiKeys[modelProvider] || '';
      },
      // Custom tools and instructions
    }),
    // SQL Editor slice
    ...createSqlEditorSlice(),
  }),
);
```

### Using AI Query Controls

```tsx
import {QueryControls} from '@sqlrooms/ai';

function AiQueryPanel() {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-4 text-xl font-bold">Ask AI</h2>
      <QueryControls
        placeholder="Ask a question about your data..."
        onSubmit={(query) => console.log('Processing query:', query)}
      />
    </div>
  );
}
```

### Displaying Analysis Results

```tsx
import {AnalysisResultsContainer, AnalysisResult} from '@sqlrooms/ai';

function AnalysisPanel() {
  // Get the current session and its analysis results
  const currentSession = useRoomStore((state) => state.ai.getCurrentSession());
  const analysisResults = currentSession?.analysisResults || [];

  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-4 text-xl font-bold">AI Analysis</h2>
      <AnalysisResultsContainer>
        {analysisResults.map((result) => (
          <AnalysisResult key={result.id} result={result} />
        ))}
      </AnalysisResultsContainer>
    </div>
  );
}
```

### Working with AI State

```tsx
function AiStatusIndicator() {
  const isRunningAnalysis = useRoomStore((state) => state.ai.isRunningAnalysis);
  const analysisPrompt = useRoomStore((state) => state.ai.analysisPrompt);
  const currentSession = useRoomStore((state) => state.ai.getCurrentSession());
  const lastResult =
    currentSession?.analysisResults[currentSession.analysisResults.length - 1];

  if (isRunningAnalysis) {
    return <div>AI is analyzing your data...</div>;
  }

  if (lastResult?.errorMessage) {
    return <div>Error: {lastResult.errorMessage.message}</div>;
  }

  if (analysisPrompt) {
    return <div>Last query: "{analysisPrompt}"</div>;
  }

  return <div>Ask AI a question about your data</div>;
}
```

## AiSlice API Reference

The AiSlice provides a comprehensive set of state fields and methods for managing AI interactions in your application.

### State Fields

#### `analysisPrompt`

The current prompt text entered by the user for analysis.

```tsx
const prompt = useRoomStore((state) => state.ai.analysisPrompt);
```

#### `isRunningAnalysis`

Boolean flag indicating whether an analysis is currently in progress.

```tsx
const isRunning = useRoomStore((state) => state.ai.isRunningAnalysis);
```

#### `tools`

Record of available AI tools that can be used during analysis.

```tsx
const availableTools = useRoomStore((state) => state.ai.tools);
```

#### `analysisAbortController`

Optional AbortController instance that can be used to cancel an ongoing analysis.

```tsx
const abortController = useRoomStore(
  (state) => state.ai.analysisAbortController,
);
```

### Methods

#### `setAnalysisPrompt(prompt: string)`

Sets the current analysis prompt text.

```tsx
const setPrompt = useRoomStore((state) => state.ai.setAnalysisPrompt);
setPrompt('Analyze sales trends for the last quarter');
```

#### `startAnalysis()`

Starts the analysis process using the current prompt.

```tsx
const startAnalysis = useRoomStore((state) => state.ai.startAnalysis);
await startAnalysis();
```

#### `cancelAnalysis()`

Cancels any ongoing analysis.

```tsx
const cancelAnalysis = useRoomStore((state) => state.ai.cancelAnalysis);
cancelAnalysis();
```

#### `setAiModel(modelProvider: string, model: string)`

Sets the AI model and provider for the current session.

```tsx
const setModel = useRoomStore((state) => state.ai.setAiModel);
setModel('openai', 'gpt-4o');
```

#### `createSession(name?: string, modelProvider?: string, model?: string)`

Creates a new analysis session with optional name and model settings.

```tsx
const createSession = useRoomStore((state) => state.ai.createSession);
createSession('Financial Analysis', 'openai', 'gpt-4o');
```

#### `switchSession(sessionId: string)`

Switches to a different analysis session by ID.

```tsx
const switchSession = useRoomStore((state) => state.ai.switchSession);
switchSession('session-123');
```

#### `renameSession(sessionId: string, name: string)`

Renames an existing analysis session.

```tsx
const renameSession = useRoomStore((state) => state.ai.renameSession);
renameSession('session-123', 'Q4 Sales Analysis');
```

#### `deleteSession(sessionId: string)`

Deletes an analysis session by ID.

```tsx
const deleteSession = useRoomStore((state) => state.ai.deleteSession);
deleteSession('session-123');
```

#### `getCurrentSession()`

Returns the current active analysis session.

```tsx
const currentSession = useRoomStore((state) => state.ai.getCurrentSession());
```

#### `deleteAnalysisResult(sessionId: string, resultId: string)`

Deletes a specific analysis result from a session.

```tsx
const deleteResult = useRoomStore((state) => state.ai.deleteAnalysisResult);
deleteResult('session-123', 'result-456');
```

#### `findToolComponent(toolName: string)`

Finds the React component associated with a specific tool.

```tsx
const ChartComponent = useRoomStore((state) =>
  state.ai.findToolComponent('chart'),
);
```

## Data Structure

The basic data structure of the AI package is:

```ts
ai: {
  sessions: [
    {
      id: defaultSessionId,
      name: 'Default Session',
      modelProvider: 'openai',
      model: 'gpt-4o-mini',
      analysisResults: [],
      createdAt: new Date(),
    },
  ],
  currentSessionId: defaultSessionId,
}
```

Each session has a `analysisResults` which is an array of `AnalysisResult`. Each `AnalysisResult` has the following properties:

- `id`: The unique identifier for the analysis result
- `prompt`: The user prompt that was used to generate the analysis result
- `streamMessage`: The stream message from the LLM
- `errorMessage`: The error message from the LLM
- `isCompleted`: Whether the analysis result has been completed

For each user prompt, the LLM will run multiple tools (e.g. `query`, `chart`) and return the result as the `streamMessage`. The structure of the `streamMessage` is as follows:

- `text`: the final response from the LLM (streamable)
- `reasoning`: the reasoning of the LLM (only for reason models)
- `toolCallMessages`: the message array of the tool calls executed by the LLM

Each `toolCallMessages` has the following properties:

- `toolName`: the name of the tool
- `toolCallId`: the id of the tool call
- `args`: the arguments of the tool call
- `llmResult`: the result from the execution of the tool, which will be sent back to the LLM as response.
- `additionalData`: the additional data of the tool, which can be used to pass the output of the tool to next tool call or the component for rendering.

## Rendering

```
|--------------------------------|
| AnalysisResultsContainer       |
|--------------------------------|
|  |--------------------------|  |
|  | AnalysisResult           |  |
|  |                          |  |
|  | streamMessage            |  |
|  |                          |  |
|  | |---------------------|  |  |
|  | | Tools               |  |  |
|  | |---------------------|  |  |
|  | | |---------------|   |  |  |
|  | | |ToolCallMessage|   |  |  |
|  | | |---------------|   |  |  |
|  | | |---------------|   |  |  |
|  | | |ToolCallMessage|   |  |  |
|  | | |---------------|   |  |  |
|  | |    ...              |  |  |
|  | |---------------------|  |  |
|  |                          |  |
|  | text                     |  |
|  |--------------------------|  |
|--------------------------------|
```

## Tools

In AI package, we provide a tool() to allow creating function tool for LLM to use. It is an extension of the `tool` from `vercel ai sdk`, and it supports not only `execute` function, but also `context` object and `component` object:

- `execute` needs to return
  - llmResult: the result send back to LLM (no raw data)
  - additionalData: the data will be used by `component` and next `tool`
- `context`
  - provide e.g. runtime or async data for `execute`
  - `execute` can access `context` via `options.context`
- `component`
  - use `additionalData` to render a React component for this `tool`

For example, the `query` tool is defined as follows:

```ts
const functions = {
  weather: tool({
    description: 'Get the weather in a city from a weather station',
    parameters: z.object({cityName: z.string()}),
    execute: async ({cityName}, options) => {
      const getStation = options.context?.getStation;
      const station = getStation ? await getStation(cityName) : null;
      return {
        llmResult: `The weather in ${cityName} is sunny from weather station ${station}.`,
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
    component: WeatherStation,
  }),
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
