/**
 * Utility functions for AI Chat UI configuration
 */

import {AiModelSliceConfig} from './AiConfigSlice';

type AiModelConfig = AiModelSliceConfig['aiModelConfig'];

export function createDefaultSessionConfig(sessionId: string) {
  return {
    id: sessionId,
    modelType: 'default' as const,
    selectedModelId: 'gpt-4.1',
    customModel: {
      baseUrl: '',
      apiKey: '',
      modelName: '',
    },
  };
}

/**
 * Get the API key for the currently selected model
 * @param config - The AI Chat UI configuration
 * @returns The API key for the selected model, or empty string if not found
 */
export function getApiKey(sessionId: string, config: AiModelConfig): string {
  const session = config.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return '';
  }

  if (session.modelType === 'custom') {
    return session.customModel.apiKey;
  }

  if (!session.selectedModelId) {
    return '';
  }

  // Find the model across all providers
  for (const providerKey in config.models) {
    const provider = config.models[providerKey];
    if (provider) {
      const model = provider.models.find(
        (model) => model.id === session.selectedModelId,
      );
      if (model) {
        return provider.apiKey || '';
      }
    }
  }
  return '';
}

/**
 * Get the base URL for the currently selected model
 * @param config - The AI Chat UI configuration
 * @returns The base URL for the selected model, or undefined if not found
 */
export function getBaseUrl(
  sessionId: string,
  config: AiModelConfig,
): string | undefined {
  const session = config.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return undefined;
  }

  if (session.modelType === 'custom') {
    return session.customModel.baseUrl;
  }

  if (!session.selectedModelId) {
    return undefined;
  }

  // Find the model across all providers
  for (const providerKey in config.models) {
    const provider = config.models[providerKey];
    if (provider) {
      const model = provider.models.find(
        (model) => model.id === session.selectedModelId,
      );
      if (model) {
        return provider.baseUrl;
      }
    }
  }
  return undefined;
}

/**
 * Get the selected model information
 * @param sessionId - The session ID to get the model for
 * @param config - The AI Chat UI configuration
 * @returns The selected model information, or null if not found
 */
export function getSelectedModel(
  sessionId: string,
  config: AiModelConfig,
): {
  id: string;
  modelName: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
} | null {
  const session = config.sessions.find((s) => s.id === sessionId);
  if (!session) {
    return null;
  }

  if (session.modelType === 'custom') {
    return {
      id: 'custom',
      modelName: session.customModel.modelName,
      provider: 'custom',
      baseUrl: session.customModel.baseUrl,
      apiKey: session.customModel.apiKey,
    };
  }

  if (!session.selectedModelId) {
    return null;
  }

  // Find the model across all providers
  for (const providerKey in config.models) {
    const provider = config.models[providerKey];
    if (provider) {
      const model = provider.models.find(
        (model) => model.id === session.selectedModelId,
      );
      if (model) {
        return {
          id: model.id,
          modelName: model.modelName,
          provider: provider.provider,
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
        };
      }
    }
  }
  return null;
}
