/**
 * Utility functions for AI Chat UI configuration
 */

import {AiSettingsSliceConfig, AnalysisResultSchema} from '@sqlrooms/ai-config';
import {UIMessage} from 'ai';
import {UIMessagePart} from '@sqlrooms/ai-config/src/UIMessageSchema';

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
 * Transforms a flat list of UI messages into a structured list of analysis results.
 *
 * This function parses the conversation history (stored as flat UIMessage array) and
 * reconstructs the user prompt → AI response pairs that represent each analysis interaction.
 *
 * @param uiMessages - The flat array of UI messages from the chat history
 * @param legacyAnalysisResults - Optional legacy analysis results for error message backward compatibility
 * @returns Array of analysis results, where each result contains:
 *   - id: Unique identifier from the user message
 *   - prompt: The user's question/request text
 *   - response: The AI assistant's response parts (may include text, tool calls, etc.)
 *   - isCompleted: Whether the AI finished responding (has an assistant message)
 *   - errorMessage: Optional error if the analysis failed (preserved from legacy data)
 */
export function transformMessagesToAnalysisResults(
  uiMessages: UIMessage[],
  legacyAnalysisResults?: AnalysisResultSchema[],
): AnalysisResultSchema[] {
  // Early return: no messages to process
  if (!uiMessages?.length) return [];

  const results: AnalysisResultSchema[] = [];
  let i = 0;

  // Iterate through all messages to find user-assistant pairs
  while (i < uiMessages.length) {
    const userMessage = uiMessages[i];

    // Skip messages that aren't from the user (e.g., system messages)
    if (!userMessage || userMessage.role !== 'user') {
      i++;
      continue;
    }

    // Extract the text content from the user's message parts
    // UIMessage parts can contain text, images, tool calls, etc.
    // We only want the text parts for the prompt
    const prompt = userMessage.parts
      .filter((part: UIMessagePart) => part.type === 'text')
      .map((part) => (part as {text: string}).text)
      .join('');

    // Look ahead to find the assistant's response to this user message
    let response: UIMessagePart[] = [];
    let isCompleted = false;
    let nextIndex = i + 1;

    // Scan forward from the current user message
    for (let j = i + 1; j < uiMessages.length; j++) {
      const nextMessage = uiMessages[j];
      if (!nextMessage) continue;

      if (nextMessage.role === 'assistant') {
        // Found the assistant's response to this user message
        response = nextMessage.parts;
        isCompleted = true;
        nextIndex = j + 1; // Move past the assistant message for next iteration
        break;
      } else if (nextMessage.role === 'user') {
        // Hit the next user message before finding an assistant response
        // This means the assistant never responded (incomplete analysis)
        nextIndex = j;
        break;
      }
      // Note: we skip over any intermediate messages (e.g., tool results)
    }

    // Check for legacy error information stored in analysisResults
    // This is for backward compatibility with older data structures
    // where error states were tracked separately
    const relatedAnalysisResult = legacyAnalysisResults?.find(
      (result: AnalysisResultSchema) => result.id === userMessage.id,
    );

    // Construct the analysis result for this user-assistant pair
    results.push({
      id: userMessage.id,
      prompt,
      response,
      errorMessage: relatedAnalysisResult?.errorMessage,
      isCompleted,
    });

    // Move to the next message to process
    i = nextIndex;
  }

  return results;
}
