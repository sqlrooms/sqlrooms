# @sqlrooms/ai-chatui

Reusable AI chat UI components and configuration slice for SQLRooms applications.

## Overview

This package provides a complete set of UI components and state management for AI assistant interfaces, including:

- **AiConfigSlice**: Zustand slice for managing AI model configuration
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
- **State Management**: Built-in Zustand slice for configuration persistence
- **TypeScript**: Full TypeScript support with proper type definitions
- **Responsive**: Modern UI components with responsive design
- **Error Handling**: Built-in error reporting and connection status management

## Usage

### Basic Setup

```tsx
import {
  createAiConfigSlice,
  useStoreWithAiConfig,
  AssistantPanel,
  ModelUsageData
} from '@sqlrooms/ai-chatui';

// Add the slice to your store
const useAppStore = create<AppState>()((...args) => ({
  // ... other slices
  aiConfig: createAiConfigSlice()(...args),
}));

// ModelOptions example
const modelOptions = [
  { provider: 'openai', label: 'gpt-4o', value: 'gpt-4o' },
  { provider: 'anthropic', label: 'claude-4-sonnet', value: 'claude-4-sonnet' },
  { provider: 'google', label: 'gemini-2.0-flash', value: 'gemini-2.0-flash' },
  { provider: 'deepseek', label: 'deepseek-chat', value: 'deepseek-chat' },
  { provider: 'ollama', label: 'qwen3:32b', value: 'qwen3:32b' }
];


// Create model usage data (optional)
const modelUsage: ModelUsageData = {
  totalSpend: 15.50,
  maxBudget: 100.00,
  isLoadingSpend: false,
  weeklySpend: [
    { date: '2024-01-01', spend: 2.50 },
    { date: '2024-01-02', spend: 3.25 }
  ],
  isLoadingWeeklySpend: false
};

// Model status function
const getModelStatus = () => ({
  isReady: true,
  error: undefined
});

// Proxy base URL function
const getProxyBaseUrl = () => 'https://api.example.com/liteLLM/v1';

// Use the assistant panel
<AssistantPanel
  currentSessionId={currentSessionId}
  getModelStatus={getModelStatus}
  supportUrl="https://support.example.com"
  modelOptions={modelOptions}
  modelUsage={modelUsage} // Optional
  getProxyBaseUrl={getProxyBaseUrl}
/>
```

### Individual Components

```tsx
import {
  AiConfigPanel,
  AiModelSelection,
  AiModelParameters,
  AiModelUsage,
  ModelUsageData
} from '@sqlrooms/ai-chatui';

// Create model usage data (optional)
const modelUsage: ModelUsageData = {
  totalSpend: 15.50,
  maxBudget: 100.00,
  isLoadingSpend: false
};

// Use individual components as needed
<AiConfigPanel
  isOpen={isConfigOpen}
  setIsOpen={setIsConfigOpen}
  modelOptions={modelOptions}
  modelUsage={modelUsage} // Optional - usage panel will be hidden if not provided
  getProxyBaseUrl={() => 'https://api.example.com/liteLLM/v1'}
/>
```

### Without Usage Tracking

```tsx
// Minimal setup without usage tracking
<AssistantPanel
  currentSessionId={currentSessionId}
  getModelStatus={() => ({ isReady: true })}
  supportUrl="https://support.example.com"
  modelOptions={modelOptions}
  getProxyBaseUrl={() => 'https://api.example.com/liteLLM/v1'}
  // modelUsage is optional - no usage panel will be shown
/>
```

## API Reference

### Function-based Configuration

The package uses functions instead of static values for better flexibility:

- **`getModelStatus()`**: Returns model readiness status and error details
- **`getProxyBaseUrl()`**: Provides dynamic base URL resolution

### Optional Usage Tracking

Usage tracking is completely optional:

- **`modelUsage`**: Optional parameter for billing and usage data
- **`AiModelUsage`**: Only renders when `modelUsage` is provided
- **Flexible**: Applications can choose whether to include usage features

### Error Handling

Enhanced error reporting:

```tsx
const getModelStatus = () => ({
  isReady: !hasConnectionError && isDataAvailable,
  error: connectionError?.message
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

The package follows a clean separation of concerns:

- **Slice**: Pure state management logic with localStorage persistence
- **Components**: Reusable UI components with optional features
- **Functions**: Dynamic behavior through function props
- **Types**: Well-defined interfaces for configuration

This design allows for maximum reusability while maintaining type safety and clear boundaries between different concerns. The function-based API enables dynamic behavior while keeping components pure and testable.
