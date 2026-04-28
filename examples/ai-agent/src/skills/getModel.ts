import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import type {AiSliceState} from '@sqlrooms/ai-core';
import type {StoreApi} from '@sqlrooms/room-store';
import type {LanguageModel} from 'ai';

/**
 * Resolve the current session's language model from the AI slice. Mirrors
 * the helper in `WeatherAgent.ts` so both call sites stay in sync.
 */
export function getModel(store: StoreApi<AiSliceState>): LanguageModel {
  const state = store.getState();
  const currentSession = state.ai.getCurrentSession();
  const provider = currentSession?.modelProvider || 'openai';
  const modelId = currentSession?.model || 'gpt-4.1';

  return createOpenAICompatible({
    apiKey: state.ai.getApiKeyFromSettings(),
    name: provider || '',
    baseURL: state.ai.getBaseUrlFromSettings() || 'https://api.openai.com/v1',
  }).chatModel(modelId);
}
