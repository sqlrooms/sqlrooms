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

export type {AiChatUiSliceState as AiChatUiState} from './AiConfigSlice';

// Export UI components
export {AiConfigPanel} from './components/AiConfigPanel';
export {AiModelParameters} from './components/AiModelParameters';
export {AiModelSelection} from './components/AiModelConfig';
export {AiModelSelector} from './components/AiModelSelector';
export {AiModelUsage} from './components/AiModelUsage';

// Export types
export type {ModelUsageData} from './types';
