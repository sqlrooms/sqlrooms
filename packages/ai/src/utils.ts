/**
 * Utility functions for AI Chat UI configuration
 */

import {AiModelSliceConfig} from './AiConfigSlice';

type AiModelConfig = AiModelSliceConfig['aiModelConfig'];

/**
 * Get the API key for the currently selected model
 * @param config - The AI Chat UI configuration
 * @returns The API key for the selected model, or empty string if not found
 */
export function getApiKey(
  config: AiModelConfig,
  modelProvider: string,
  model: string,
): string {
  // If modelProvider is 'custom', find the model in customModels
  if (modelProvider === 'custom') {
    const customModel = config.customModels.find(
      (customModel) => customModel.modelName === model,
    );
    return customModel?.apiKey || '';
  }

  // Otherwise, find the provider and return its apiKey
  const provider = config.providers[modelProvider];
  return provider?.apiKey || '';
}

/**
 * Get the base URL for the specified model
 * @param config - The AI Chat UI configuration
 * @param modelProvider - The model provider name
 * @param model - The model name
 * @returns The base URL for the selected model, or undefined if not found
 */
export function getBaseUrl(
  config: AiModelConfig,
  modelProvider: string,
  model: string,
): string | undefined {
  // If modelProvider is 'custom', find the model in customModels
  if (modelProvider === 'custom') {
    const customModel = config.customModels.find(
      (customModel) => customModel.modelName === model,
    );
    return customModel?.baseUrl;
  }

  // Otherwise, find the provider and return its baseUrl
  const provider = config.providers[modelProvider];
  if (provider) {
    const modelExists = provider.models.find(
      (modelItem) => modelItem.modelName === model,
    );
    if (modelExists) {
      return provider.baseUrl;
    }
  }
  return undefined;
}

/**
 * Extract models from aiModelConfig in the format expected by ModelSelector
 * @param config - The AI model configuration
 * @returns Array of models with provider, label, and value properties
 */
export function extractModelsFromConfig(config: AiModelConfig): Array<{
  provider: string;
  label: string;
  value: string;
}> {
  const models: Array<{
    provider: string;
    label: string;
    value: string;
  }> = [];

  // Extract models from providers
  Object.entries(config.providers).forEach(([providerKey, provider]) => {
    provider.models.forEach((model) => {
      models.push({
        provider: providerKey,
        label: model.modelName,
        value: model.modelName,
      });
    });
  });

  // Add custom models
  config.customModels.forEach((customModel) => {
    models.push({
      provider: 'custom',
      label: customModel.modelName,
      value: customModel.modelName,
    });
  });

  return models;
}
