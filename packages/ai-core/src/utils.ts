/**
 * Utility functions for AI Chat UI configuration
 */

import {
  AiSettingsSliceConfig,
  AnalysisResultSchema,
  AnalysisSessionSchema,
  UIMessagePartSchema,
  ToolUIPartSchema,
  TextUIPartSchema,
  DynamicToolUIPartSchema,
} from '@sqlrooms/ai-config';

/**
 * Custom error class for operation abort errors.
 * This allows for type-safe error handling when operations are cancelled by the user.
 *
 * Tools should throw this error when they detect an abort signal,
 * and error handlers can check for this specific error type to provide
 * appropriate user feedback.
 *
 * @example
 * ```ts
 * if (abortSignal?.aborted) {
 *   throw new ToolAbortError('Operation was aborted');
 * }
 * ```
 *
 * @example
 * ```ts
 * try {
 *   await someTool.execute(params, { abortSignal });
 * } catch (error) {
 *   if (error instanceof ToolAbortError) {
 *     console.log('User cancelled the operation');
 *   }
 * }
 * ```
 */
export class ToolAbortError extends Error {
  constructor(message: string = 'Operation was aborted') {
    super(message);
    this.name = 'ToolAbortError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ToolAbortError);
    }
  }
}

/**
 * Type guard that checks whether a value is a non-null object.
 *
 * Note: This intentionally does not verify "plain object" vs arrays/functions;
 * callers should add stricter checks when needed.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getReasoningTextFromInput(part: UIMessagePartSchema) {
  if (typeof part === 'object' && 'input' in part && isRecord(part.input)) {
    return `${part.input.reasoning}` || undefined;
  }
  return undefined;
}

export function getToolName(part: UIMessagePartSchema): string {
  if (typeof part.type === 'string' && part.type === 'dynamic-tool') {
    return ((part as any).toolName || 'unknown') as string;
  }
  if (isToolPart(part)) {
    return typeof part.type === 'string'
      ? part.type.replace(/^tool-/, '') || 'unknown'
      : 'unknown';
  }
  return 'unknown';
}

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
export function isTextPart(
  part: UIMessagePartSchema,
): part is TextUIPartSchema {
  return part.type === 'text';
}

/**
 * Type guard to check if a UIMessagePart is a reasoning part
 * @param part - The message part to check
 * @returns True if the part is a reasoning part
 */
export function isReasoningPart(
  part: UIMessagePartSchema,
): part is Extract<UIMessagePartSchema, {type: 'reasoning'; text: string}> {
  return part.type === 'reasoning';
}

/**
 * Type guard to check if a UIMessagePart is a tool part (type starts with 'tool-')
 * @param part - The message part to check
 * @returns True if the part is a tool part
 */
export function isToolPart(
  part: UIMessagePartSchema,
): part is ToolUIPartSchema {
  return typeof part.type === 'string' && part.type.startsWith('tool-');
}

export function isDynamicToolPart(
  part: UIMessagePartSchema,
): part is DynamicToolUIPartSchema {
  return part.type === 'dynamic-tool';
}

/**
 * Cleans up pending analysis results from interrupted conversations and restores them
 * with proper IDs from actual user messages. This handles the case where a page refresh
 * occurred during an active analysis, leaving orphaned "__pending__" results.
 *
 * Should be called once when loading persisted session data, not in migrations.
 *
 * @param session - The session to clean up
 * @returns The cleaned session with restored analysis results
 */
export function cleanupPendingAnalysisResults(
  session: AnalysisSessionSchema,
): AnalysisSessionSchema {
  const {analysisResults, uiMessages} = session;

  if (!Array.isArray(analysisResults) || !Array.isArray(uiMessages)) {
    return session;
  }

  // Remove all pending results
  const nonPendingResults = analysisResults.filter(
    (result) => result.id !== '__pending__',
  );

  // Find all user messages that don't have a corresponding assistant response
  const orphanedUserMessages: Array<{id: string; prompt: string}> = [];

  for (let i = 0; i < uiMessages.length; i++) {
    const message = uiMessages[i];
    if (!message || message.role !== 'user') {
      continue;
    }

    // Check if there's an assistant message after this user message
    const hasAssistantResponse = uiMessages
      .slice(i + 1)
      .some((m) => m && m.role === 'assistant');

    if (!hasAssistantResponse) {
      // Extract text from message parts
      const prompt = message.parts
        .filter((part) => part.type === 'text')
        .map((part) => (part as {text: string}).text)
        .join('');

      orphanedUserMessages.push({
        id: message.id,
        prompt,
      });
    }
  }

  // For each orphaned user message, check if it already has an analysis result
  // If not, create one
  const existingResultIds = new Set(nonPendingResults.map((r) => r.id));
  const restoredResults: AnalysisResultSchema[] = orphanedUserMessages
    .filter(({id}) => !existingResultIds.has(id))
    .map(({id, prompt}) => ({
      id,
      prompt,
      isCompleted: true, // Mark as completed since the user did submit it
    }));

  return {
    ...session,
    analysisResults: [...nonPendingResults, ...restoredResults],
  };
}
