# @sqlrooms/ai-chatui

Reusable AI chat UI components and configuration slice for SQLRooms applications.

## Overview

This package provides a complete set of UI components and state management for AI assistant interfaces, including:

- **AiChatUiSlice**: Zustand slice for managing AI model configuration with room-shell integration
- **AiConfigPanel**: Main configuration panel with model selection, parameters, and optional usage tracking
- **AiModelSelection**: Component for selecting between default and custom AI models
- **AiModelParameters**: Component for configuring model parameters like max steps and system instructions
- **AiModelUsage**: Optional component for displaying billing and usage information
- **AssistantPanel**: Main assistant panel component (independent of external dependencies)

## Features

- **Reusable**: Can be used across different applications with flexible configuration
- **Configurable**: Supports both default and custom AI model configurations
- **Optional Usage Tracking**: Billing and usage components are optional
- **Function-based API**: Uses functions for dynamic behavior (connection status, base URLs)
- **State Management**: Built-in Zustand slice with room-shell integration for configuration persistence
- **TypeScript**: Full TypeScript support with proper type definitions
- **Responsive**: Modern UI components with responsive design
- **Error Handling**: Built-in error reporting and connection status management
- **Room Integration**: Seamlessly integrates with SQLRooms room-shell architecture

## Usage

### Basic Setup

```tsx
import {
  createAiChatUiSlice,
  useStoreWithAiChatUi,
  AssistantPanel,
  ModelUsageData,
  AiChatUiSliceConfig,
} from '@sqlrooms/ai-chatui';
import {createRoomStore} from '@sqlrooms/room-shell';

// Define your room configuration including AI chat UI
const roomConfig = {
  // ... other room configuration
  aiChatUi: {
    type: 'default' as const,
    models: [
      {id: 'gpt-4o-mini', model: 'gpt-4o-mini', provider: 'openai', apiKey: ''},
    ],
    selectedModelId: 'gpt-4o-mini',
    customModel: {baseUrl: '', apiKey: '', modelName: ''},
    modelParameters: {maxSteps: 10, systemInstruction: ''},
  },
};

// Create the room store with AI chat UI slice
const useAppStore = createRoomStore(roomConfig, (store) => ({
  // ... other slices
  aiChatUi: createAiChatUiSlice()(store),
}));

// ModelOptions example
const modelOptions = [
  {provider: 'openai', label: 'gpt-4o', value: 'gpt-4o'},
  {provider: 'anthropic', label: 'claude-4-sonnet', value: 'claude-4-sonnet'},
  {provider: 'google', label: 'gemini-2.0-flash', value: 'gemini-2.0-flash'},
  {provider: 'deepseek', label: 'deepseek-chat', value: 'deepseek-chat'},
  {provider: 'ollama', label: 'qwen3:32b', value: 'qwen3:32b'},
];

// Create model usage data (optional)
const modelUsage: ModelUsageData = {
  totalSpend: 15.5,
  maxBudget: 100.0,
  isLoadingSpend: false,
  weeklySpend: [
    {date: '2024-01-01', spend: 2.5},
    {date: '2024-01-02', spend: 3.25},
  ],
  isLoadingWeeklySpend: false,
};

// Model status function (optional - typically used with proxy servers)
const getModelStatus = () => ({
  isReady: true,
  error: undefined,
});

// Proxy base URL function (optional - typically used with proxy servers)
const getProxyBaseUrl = () => 'https://api.example.com/liteLLM/v1';

// Use the assistant panel
<AssistantPanel
  currentSessionId={currentSessionId}
  getModelStatus={getModelStatus} // Optional - for checking proxy server connection status
  isDataAvailable={true} // Whether data is available for analysis
  supportUrl="https://support.example.com"
  modelOptions={modelOptions}
  modelUsage={modelUsage} // Optional
  getProxyBaseUrl={getProxyBaseUrl} // Optional - for proxy server base URL
  hideApiKeyInputForDefaultModels={true} // Optional - hide API key input when using proxy servers
/>;
```

### Individual Components

```tsx
import {
  AiConfigPanel,
  AiModelSelection,
  AiModelParameters,
  AiModelUsage,
  ModelUsageData,
  useStoreWithAiChatUi,
} from '@sqlrooms/ai-chatui';

// Create model usage data (optional)
const modelUsage: ModelUsageData = {
  totalSpend: 15.5,
  maxBudget: 100.0,
  isLoadingSpend: false,
};

// Use individual components as needed
<AiConfigPanel
  isOpen={isConfigOpen}
  setIsOpen={setIsConfigOpen}
  modelOptions={modelOptions}
  modelUsage={modelUsage} // Optional - usage panel will be hidden if not provided
  getProxyBaseUrl={() => 'https://api.example.com/liteLLM/v1'} // Optional - for proxy server base URL
  hideApiKeyInputForDefaultModels={true} // Optional - hide API key input when using proxy servers
/>;

// Access the AI chat UI state
const {getAiConfig, setSelectedModel, setModelParameters} =
  useStoreWithAiChatUi((state) => ({
    getAiConfig: state.getAiConfig,
    setSelectedModel: state.setSelectedModel,
    setModelParameters: state.setModelParameters,
  }));
```

### Without Usage Tracking

```tsx
// Minimal setup without usage tracking
<AssistantPanel
  currentSessionId={currentSessionId}
  getModelStatus={() => ({isReady: true})} // Optional - for checking proxy server connection status
  isDataAvailable={true}
  supportUrl="https://support.example.com"
  modelOptions={modelOptions}
  getProxyBaseUrl={() => 'https://api.example.com/liteLLM/v1'} // Optional - for proxy server base URL
  hideApiKeyInputForDefaultModels={true} // Optional - hide API key input when using proxy servers
  // modelUsage is optional - no usage panel will be shown
/>
```

## API Reference

### Slice Configuration

The package uses a slice-based configuration system that integrates with SQLRooms room-shell:

- **`createAiChatUiSlice()`**: Creates the AI chat UI slice for state management
- **`useStoreWithAiChatUi()`**: Hook to access AI chat UI state from the room store
- **`AiChatUiSliceConfig`**: TypeScript type for configuration schema
- **`createDefaultAiChatUiConfig()`**: Helper to create default configuration

### Function-based Configuration

The package uses functions instead of static values for better flexibility:

- **`getModelStatus()`**: Returns model readiness status and error details (optional - typically used with proxy servers)
- **`getProxyBaseUrl()`**: Provides dynamic base URL resolution (optional - typically used with proxy servers)

### Optional Usage Tracking

Usage tracking is completely optional:

- **`modelUsage`**: Optional parameter for billing and usage data
- **`AiModelUsage`**: Only renders when `modelUsage` is provided
- **Flexible**: Applications can choose whether to include usage features

### Proxy Server Configuration

When using proxy servers (like LiteLLM), several optional features are available:

- **`getModelStatus()`**: Optional function to check proxy server connection status
- **`getProxyBaseUrl()`**: Optional function to provide dynamic proxy server base URL
- **`hideApiKeyInputForDefaultModels`**: Optional boolean to hide API key input fields when API keys are managed by the proxy server

These features are particularly useful when:

- API keys are centrally managed by a proxy server
- You need to monitor proxy server connectivity
- Base URLs need to be dynamically resolved
- You want to simplify the UI by hiding API key inputs

### Error Handling

Enhanced error reporting:

```tsx
const getModelStatus = () => ({
  isReady: !hasConnectionError && isDataAvailable,
  error: connectionError?.message,
});
```

## Dependencies

- `@sqlrooms/ai`: Core AI functionality
- `@sqlrooms/room-shell`: Room shell components
- `@sqlrooms/ui`: UI component library
- `zustand`: State management
- `immer`: Immutable state updates
- `lucide-react`: Icons
- `recharts`: Charts for usage visualization

## Architecture

The package follows a clean separation of concerns with room-shell integration:

- **Slice**: Pure state management logic with room-shell integration and localStorage persistence
- **Components**: Reusable UI components with optional features
- **Functions**: Dynamic behavior through function props
- **Types**: Well-defined interfaces for configuration and state
- **Room Integration**: Seamlessly integrates with SQLRooms room architecture

This design allows for maximum reusability while maintaining type safety and clear boundaries between different concerns. The slice-based approach provides consistent state management across the application, while the function-based API enables dynamic behavior while keeping components pure and testable.
