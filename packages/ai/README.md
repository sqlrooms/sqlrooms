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

### Setting Up AI Integration

```tsx
import {createAiSlice, createDefaultAiConfig, useAiStore} from '@sqlrooms/ai';
import {createProjectStore} from '@sqlrooms/project-builder';

// Create a project store with AI capabilities
const useStore = createProjectStore({
  ai: createAiSlice(createDefaultAiConfig()),
});

function MyApp() {
  return (
    <ProjectStateProvider projectStore={useStore}>
      <MyDataApp />
    </ProjectStateProvider>
  );
}
```

### Using AI Query Controls

```tsx
import {QueryControls} from '@sqlrooms/ai';

function AiQueryPanel() {
  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-4">Ask AI</h2>
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
import {useAiStore} from '@sqlrooms/ai';

function AnalysisPanel() {
  const {analysisResults} = useAiStore();

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-xl font-bold mb-4">AI Analysis</h2>
      <AnalysisResultsContainer>
        {analysisResults.map((result, index) => (
          <AnalysisResult key={index} result={result} />
        ))}
      </AnalysisResultsContainer>
    </div>
  );
}
```

### Working with AI State

```tsx
import {useAiStore} from '@sqlrooms/ai';

function AiStatusIndicator() {
  const {isProcessing, lastQuery, error} = useAiStore();

  if (isProcessing) {
    return <div>AI is thinking...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (lastQuery) {
    return <div>Last query: "{lastQuery}"</div>;
  }

  return <div>Ask AI a question about your data</div>;
}
```

## Advanced Features

- **Custom AI Tools**: Define custom tools for AI to use
- **Query Templates**: Create and manage reusable query templates
- **Result Visualization**: Automatically visualize AI analysis results
- **Conversation Context**: Maintain context across multiple queries
- **Feedback Loop**: Collect user feedback to improve AI responses

## Design

### Data Structure

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
    },
```

Each session has a `analysisResults` which is an array of `AnalysisResult`.Each `AnalysisResult` has the following properties:

- `id`: The unique identifier for the analysis result
- `prompt`: The user prompt that was used to generate the analysis result
- `streamMessage`: The stream message from the LLM
- `errorMessage`: The error message from the LLM
- `isCompleted`: Whether the analysis result has been completed

For each user prompt, the LLM will run multiple tools (e.g. `query`, `chart`) and return the result as the `streamMessage`. The structure of the `streamMessage` is as follows:

- 'text': the final response from the LLM (streamable)
- 'reasoning': the reasoning of the LLM (only for reason models)
- 'toolCallMessages': the message array of the tool calls executed by the LLM

Each `toolCallMessages` has the following properties:

- 'toolName': the name of the tool
- 'toolCallId': the id of the tool call
- 'args': the arguments of the tool call
- 'llmResult': the result from the execution of the tool, which will be sent back to the LLM as response.
- 'additionalData': the additional data of the tool, which can be used to pass the output of the tool to next tool call or the component for rendering.

### Rendering

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
      parameters: z.object({ cityName: z.string() })
      execute: async ({ cityName }, options) => {
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

For more information, visit the SQLRooms documentation.
