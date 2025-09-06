/**
 * @packageDocumentation
 * AI Chat UI components and configuration slice for reusable AI assistant interfaces
 */

// Export the AI configuration slice
export {
  createAiConfigSlice,
  useStoreWithAiConfig
} from './AiConfigSlice';

export type {
  AiConfigState,
  AiConfigActions,
  AiConfigSlice
} from './AiConfigSlice';

// Export UI components
export {AiConfigPanel} from './components/AiConfigPanel';
export {AiModelParameters} from './components/AiModelParameters';
export {AiModelSelection} from './components/AiModelSelection';
export {AiModelUsage} from './components/AiModelUsage';
export {AssistantPanel} from './components/AssistantPanel';

// Export types
export type {ModelUsageData} from './types';
