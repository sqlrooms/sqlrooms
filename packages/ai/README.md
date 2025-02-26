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

For more information, visit the SQLRooms documentation.
