/**
 * Utility functions for AI Chat UI configuration
 */

import {
  AiSettingsSliceConfig,
  AnalysisResultSchema,
  UIMessagePart,
} from '@sqlrooms/ai-config';
import {UIMessage, TextUIPart, ToolUIPart} from 'ai';

/**
 * Extract models from aiSettings in the format expected by ModelSelector
 * @param config - The AI model configuration
 * @returns Array of models with provider, label, and value properties
 */
export function extractModelsFromSettings(
  config: AiSettingsSliceConfig,
): Array<{
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

/**
 * Type guard to check if a UIMessagePart is a text part
 * @param part - The message part to check
 * @returns True if the part is a text part
 */
export function isTextPart(part: UIMessagePart): part is TextUIPart {
  return part.type === 'text';
}

/**
 * Type guard to check if a UIMessagePart is a reasoning part
 * @param part - The message part to check
 * @returns True if the part is a reasoning part
 */
export function isReasoningPart(
  part: UIMessagePart,
): part is Extract<UIMessagePart, {type: 'reasoning'; text: string}> {
  return part.type === 'reasoning';
}

/**
 * Type guard to check if a UIMessagePart is a tool part (type starts with 'tool-')
 * @param part - The message part to check
 * @returns True if the part is a tool part
 */
export function isToolPart(part: UIMessagePart): part is ToolUIPart {
  return typeof part.type === 'string' && part.type.startsWith('tool-');
}
