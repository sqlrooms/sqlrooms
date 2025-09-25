/**
 * Utility functions for AI Chat UI configuration
 */

import {Tool} from 'ai';
import {AiSliceTool} from './AiSlice';
import {AiSettingsSliceConfig} from './AiSettingsSlice';

type AiModelConfig = AiSettingsSliceConfig['aiSettings'];

/**
 * Extract models from aiSettings in the format expected by ModelSelector
 * @param config - The AI model configuration
 * @returns Array of models with provider, label, and value properties
 */
export function extractModelsFromSettings(config: AiModelConfig): Array<{
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

export function convertToVercelAiTool({
  tool,
  onToolCompleted,
}: {
  tool: AiSliceTool;
  onToolCompleted: (toolCallId: string, additionalData: unknown) => void;
}): Tool {
  const vercelAiTool = {
    description: tool.description,
    inputSchema: tool.parameters,
    // outputSchema: tool.outputSchema,
    execute: async (args: Record<string, unknown>, options: any) => {
      const result = await tool.execute(args as any, {
        ...options,
        context: tool.context,
      });

      if (onToolCompleted) {
        onToolCompleted(options.toolCallId, result.additionalData);
      }

      return result.llmResult;
    },
  };
  return vercelAiTool;
}
