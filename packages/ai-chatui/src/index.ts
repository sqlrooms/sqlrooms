/**
 * @packageDocumentation
 * AI Chat UI components and configuration slice for reusable AI assistant interfaces
 */

// Export the AI configuration slice
export {
  createAiChatUiSlice,
  useStoreWithAiChatUi,
  AiChatUiSliceConfig,
  createDefaultAiChatUiConfig,
} from './AiConfigSlice';

export type {
  AiChatUiSliceState as AiChatUiState,
  AiChatUiActions,
  AiChatUiSlice,
} from './AiConfigSlice';

// Export UI components
export {AiConfigPanel} from './components/AiConfigPanel';
export {AiModelParameters} from './components/AiModelParameters';
export {AiModelSelection} from './components/AiModelSelection';
export {AiModelUsage} from './components/AiModelUsage';
export {AssistantPanel} from './components/AssistantPanel';

// Export types
export type {ModelUsageData} from './types';
