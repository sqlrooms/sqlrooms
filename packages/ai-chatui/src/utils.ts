/**
 * Utility functions for AI Chat UI configuration
 */

export interface AiChatUiConfig {
  type: 'default' | 'custom';
  models: Record<
    string,
    {
      provider: string;
      baseUrl: string;
      apiKey: string;
      models: Array<{
        id: string;
        modelName: string;
      }>;
    }
  >;
  selectedModelId?: string;
  customModel: {
    baseUrl: string;
    apiKey: string;
    modelName: string;
  };
  modelParameters: {
    maxSteps: number;
    additionalInstruction: string;
  };
}

/**
 * Get the API key for the currently selected model
 * @param config - The AI Chat UI configuration
 * @returns The API key for the selected model, or empty string if not found
 */
export function getApiKey(config: AiChatUiConfig): string {
  if (config.type === 'custom') {
    return config.customModel.apiKey;
  }

  if (!config.selectedModelId) {
    return '';
  }

  // Find the model across all providers
  for (const providerKey in config.models) {
    const provider = config.models[providerKey];
    if (provider) {
      const model = provider.models.find(
        (model) => model.id === config.selectedModelId,
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
export function getBaseUrl(config: AiChatUiConfig): string | undefined {
  if (config.type === 'custom') {
    return config.customModel.baseUrl;
  }

  if (!config.selectedModelId) {
    return undefined;
  }

  // Find the model across all providers
  for (const providerKey in config.models) {
    const provider = config.models[providerKey];
    if (provider) {
      const model = provider.models.find(
        (model) => model.id === config.selectedModelId,
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
 * @param config - The AI Chat UI configuration
 * @returns The selected model information, or null if not found
 */
export function getSelectedModel(config: AiChatUiConfig): {
  id: string;
  modelName: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
} | null {
  if (config.type === 'custom') {
    return {
      id: 'custom',
      modelName: config.customModel.modelName,
      provider: 'custom',
      baseUrl: config.customModel.baseUrl,
      apiKey: config.customModel.apiKey,
    };
  }

  if (!config.selectedModelId) {
    return null;
  }

  // Find the model across all providers
  for (const providerKey in config.models) {
    const provider = config.models[providerKey];
    if (provider) {
      const model = provider.models.find(
        (model) => model.id === config.selectedModelId,
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
