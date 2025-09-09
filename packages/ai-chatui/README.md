# @sqlrooms/ai-chatui

Reusable AI chat UI components and configuration slice for SQLRooms applications.

## Overview

This package provides a complete set of UI components and state management for AI assistant interfaces, including:

- **createAiChatUiSlice**: Function to create a Zustand slice for managing AI model configuration with room-shell integration
- **AiConfigPanel**: Main configuration panel with model selection, parameters, and optional usage tracking
- **AiModelSelection**: Component for selecting between default and custom AI models
- **AiModelParameters**: Component for configuring model parameters like max steps and system instructions
- **AiModelUsage**: Optional component for displaying billing and usage information
- **AiModelSelector**: Standalone model selector component

**Note**: This package is now completely independent of `@sqlrooms/ai` and requires you to pass AI-related functions as props.

## Migration from @sqlrooms/ai

If you're migrating from a version that depended on `@sqlrooms/ai`, you'll need to:

1. **Remove the `@sqlrooms/ai` dependency** from your package.json
2. **Provide AI functions as props** to the components
3. **Implement the required functions** in your application:
   - `setBaseUrl(url: string | undefined)`
   - `setAiModel(provider: string, model: string)`
   - `setMaxSteps(steps: number)`
4. **Optionally provide** `getDefaultInstructions(tables: unknown[])` if you need custom system instructions

The components will work exactly the same way, but now you have full control over how the AI functions are implemented in your application.

## Features

- **Independent**: No dependencies on `@sqlrooms/ai` package - completely self-contained
- **Reusable**: Can be used across different applications with flexible configuration
- **Configurable**: Supports both default and custom AI model configurations
- **Optional Usage Tracking**: Billing and usage components are optional
- **Function-based API**: Uses functions for dynamic behavior (connection status, base URLs)
- **Prop-based Integration**: AI functions are passed as props for maximum flexibility
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
  AiConfigPanel,
  ModelUsageData,
  AiChatUiSliceConfig,
} from '@sqlrooms/ai-chatui';
import {createRoomStore} from '@sqlrooms/room-shell';

// Define your room configuration including AI chat UI
const roomConfig = {
  // ... other room configuration
  aiChatUi: {
    type: 'default' as const,
    models: {
      openai: {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        models: [
          {id: 'gpt-4o-mini', modelName: 'gpt-4o-mini'},
        ],
      },
    },
    selectedModelId: 'gpt-4o-mini',
    customModel: {baseUrl: '', apiKey: '', modelName: ''},
    modelParameters: {maxSteps: 5, additionalInstruction: ''},
  },
};

// Create the room store with AI chat UI slice
const useAppStore = createRoomStore(roomConfig, (store) => ({
  // ... other slices
  aiChatUi: createAiChatUiSlice()(store),
}));

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


// AI functions that need to be provided by your application
const setBaseUrl = (url: string | undefined) => {
  // Your implementation to set the base URL for AI requests
  console.log('Setting base URL:', url);
};

const setAiModel = (provider: string, model: string) => {
  // Your implementation to set the AI model
  console.log('Setting AI model:', provider, model);
};

const setMaxSteps = (steps: number) => {
  // Your implementation to set max steps for AI
  console.log('Setting max steps:', steps);
};

// Optional: Default instructions function (if you have access to table schemas)
const getDefaultInstructions = (tables: unknown[]) => {
  // Your implementation to generate default instructions
  return `You are analyzing data with ${tables.length} tables available.`;
};

// Use the AI config panel
<AiConfigPanel
  isOpen={isConfigOpen}
  setIsOpen={setIsConfigOpen}
  modelUsage={modelUsage} // Optional
  hideDefaultApiKeyInput={true} // Optional - hide API key input when using proxy servers
  setBaseUrl={setBaseUrl} // Required
  setAiModel={setAiModel} // Required
  setMaxSteps={setMaxSteps} // Required
  getDefaultInstructions={getDefaultInstructions} // Optional
/>;
```

### Individual Components

```tsx
import {
  AiConfigPanel,
  AiModelSelection,
  AiModelParameters,
  AiModelUsage,
  AiModelSelector,
  ModelUsageData,
  useStoreWithAiChatUi,
} from '@sqlrooms/ai-chatui';

// Create model usage data (optional)
const modelUsage: ModelUsageData = {
  totalSpend: 15.5,
  maxBudget: 100.0,
  isLoadingSpend: false,
};

// AI functions that need to be provided by your application
const setBaseUrl = (url: string | undefined) => {
  // Your implementation to set the base URL for AI requests
};

const setAiModel = (provider: string, model: string) => {
  // Your implementation to set the AI model
};

const setMaxSteps = (steps: number) => {
  // Your implementation to set max steps for AI
};

const getDefaultInstructions = (tables: unknown[]) => {
  // Your implementation to generate default instructions
  return `You are analyzing data with ${tables.length} tables available.`;
};

<AiConfigPanel
  isOpen={isConfigOpen}
  setIsOpen={setIsConfigOpen}
  modelUsage={modelUsage} // Optional - usage panel will be hidden if not provided
  hideDefaultApiKeyInput={true} // Optional - hide API key input when using proxy servers
  setBaseUrl={setBaseUrl} // Required
  setAiModel={setAiModel} // Required
  setMaxSteps={setMaxSteps} // Required
  getDefaultInstructions={getDefaultInstructions} // Optional
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
<AiConfigPanel
  isOpen={isConfigOpen}
  setIsOpen={setIsConfigOpen}
  hideDefaultApiKeyInput={true} // Optional - hide API key input when using proxy servers
  setBaseUrl={setBaseUrl} // Required
  setAiModel={setAiModel} // Required
  setMaxSteps={setMaxSteps} // Required
  // modelUsage is optional - no usage panel will be shown
  // getDefaultInstructions is optional - will show fallback message if not provided
/>
```

## API Reference

### Slice Configuration

The package uses a slice-based configuration system that integrates with SQLRooms room-shell:

- **`createAiChatUiSlice()`**: Creates the AI chat UI slice for state management
- **`useStoreWithAiChatUi()`**: Hook to access AI chat UI state from the room store
- **`AiChatUiSliceConfig`**: TypeScript type for configuration schema
- **`createDefaultAiChatUiConfig()`**: Helper to create default configuration

### Required Props

The package now requires you to provide AI-related functions as props:

- **`setBaseUrl(url: string | undefined)`**: Function to set the base URL for AI requests
- **`setAiModel(provider: string, model: string)`**: Function to set the AI model
- **`setMaxSteps(steps: number)`**: Function to set max steps for AI processing

### Optional Props

- **`getDefaultInstructions(tables: unknown[])`**: Function to generate default system instructions (optional)

### Component Props

#### AiConfigPanel Props

```tsx
interface AiConfigPanelProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  modelUsage?: ModelUsageData;
  hideDefaultApiKeyInput?: boolean;
  setBaseUrl: (url: string | undefined) => void; // Required
  setAiModel: (provider: string, model: string) => void; // Required
  setMaxSteps: (steps: number) => void; // Required
  getDefaultInstructions?: (tables: unknown[]) => string; // Optional
}
```

#### AiModelSelection Props

```tsx
interface AiModelSelectionProps {
  className?: string;
  hideDefaultApiKeyInput?: boolean;
  setBaseUrl: (url: string | undefined) => void; // Required
  setAiModel: (provider: string, model: string) => void; // Required
}
```

#### AiModelSelector Props

```tsx
interface AiModelSelectorProps {
  className?: string;
  setBaseUrl: (url: string | undefined) => void; // Required
  setAiModel: (provider: string, model: string) => void; // Required
}
```

#### AiModelParameters Props

```tsx
interface AiModelParametersProps {
  setMaxSteps: (steps: number) => void; // Required
  getDefaultInstructions?: (tables: unknown[]) => string; // Optional
}
```

### Optional Usage Tracking

Usage tracking is completely optional:

- **`modelUsage`**: Optional parameter for billing and usage data
- **`AiModelUsage`**: Only renders when `modelUsage` is provided
- **Flexible**: Applications can choose whether to include usage features

### Proxy Server Configuration

When using proxy servers (like LiteLLM), several optional features are available:

- **`getModelStatus()`**: Optional function to check proxy server connection status
- **`hideDefaultApiKeyInput`**: Optional boolean to hide API key input fields when API keys are managed by the proxy server

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

- `@sqlrooms/room-shell`: Room shell components
- `@sqlrooms/ui`: UI component library
- `@sqlrooms/utils`: Utility functions
- `@sqlrooms/recharts`: Chart components
- `zustand`: State management
- `immer`: Immutable state updates
- `lucide-react`: Icons
- `recharts`: Charts for usage visualization
- `zod`: Schema validation

## Architecture

The package follows a clean separation of concerns with room-shell integration:

- **Independent**: No external AI package dependencies - completely self-contained
- **Slice**: Pure state management logic with room-shell integration and localStorage persistence
- **Components**: Reusable UI components with optional features
- **Props-based Integration**: AI functions are passed as props for maximum flexibility
- **Types**: Well-defined interfaces for configuration and state
- **Room Integration**: Seamlessly integrates with SQLRooms room architecture

This design allows for maximum reusability while maintaining type safety and clear boundaries between different concerns. The prop-based approach enables you to integrate with any AI system while keeping the UI components pure and testable. The slice-based approach provides consistent state management across the application, while the function-based API enables dynamic behavior.
