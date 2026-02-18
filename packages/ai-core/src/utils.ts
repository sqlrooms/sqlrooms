/**
 * Utility functions for AI Chat UI configuration
 */

import {
  AiSettingsSliceConfig,
  AnalysisResultSchema,
  AnalysisSessionSchema,
  UIMessagePart,
} from '@sqlrooms/ai-config';
import {DynamicToolUIPart, TextUIPart, ToolUIPart, UIMessage} from 'ai';
import {
  ABORT_EVENT,
  ANALYSIS_PENDING_ID,
  TOOL_CALL_CANCELLED,
} from './constants';

/**
 * Merge multiple AbortSignals into a single signal.
 *
 * Why this exists:
 * - `@ai-sdk/react` (`useChat`) provides a request-level abort signal (e.g. when calling `stop()`).
 * - This app also has a per-session AbortController a.k.a the Stop button (e.g. `cancelAnalysis(sessionId)`).
 *
 * When either of those sources abort, we want downstream work (streaming / tools / fetch)
 * to see a *single* abort signal.
 *
 * Notes:
 * - If 0 signals are provided, returns `undefined` (callers can omit abort handling).
 * - If 1 signal is provided, returns it directly (no wrapping controller).
 * - If 2+ signals are provided, creates a new AbortController and aborts it when any input aborts.
 * - (not currently used) use native `AbortSignal.any()` to avoid per-request listener accumulation on long-lived signals.
 * -`{once: true}` listeners if `AbortSignal.any()` is unavailable.
 */
export function mergeAbortSignals(
  signals: Array<AbortSignal | undefined>,
): AbortSignal | undefined {
  const present = signals.filter(Boolean) as AbortSignal[];
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];

  // Prefer the platform implementation when available.
  // It avoids attaching JS event listeners to long-lived signals (e.g. per-session AbortController),
  // which would otherwise accumulate one listener per request if requests usually complete normally.
  //
  // Node >=22 and modern browsers support this.
  // We intentionally use an `any` cast to keep compatibility with older TS lib typings.
  // const anyFn = (AbortSignal as unknown as {any?: (signals: AbortSignal[]) => AbortSignal})
  //   .any;
  // if (typeof anyFn === 'function') {
  //   return anyFn(present);
  // }

  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
  };

  for (const s of present) {
    if (s.aborted) {
      abort();
      break;
    }
    s.addEventListener(ABORT_EVENT, abort, {once: true});
  }

  return controller.signal;
}

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

export function isDynamicToolPart(
  part: UIMessagePart,
): part is DynamicToolUIPart {
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
    (result) => result.id !== ANALYSIS_PENDING_ID,
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

/**
 * Validates and completes UIMessages to ensure all tool-call parts have corresponding tool-result parts.
 * This is important when canceling with AbortController, which may leave incomplete tool-calls.
 * Assumes sequential tool execution (only one tool runs at a time).
 *
 * @param messages - The messages to validate and complete
 * @returns Cleaned messages with completed tool-call/result pairs
 */
export function fixIncompleteToolCalls(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== 'assistant' || !message.parts) {
      return message;
    }

    // Walk backward and complete any TRAILING tool parts that lack output.
    // This covers multi-tool-step aborts where several tool calls were started
    // but the stream was cancelled before the outputs were emitted.
    type ToolPart = {
      type: string;
      toolCallId: string;
      toolName?: string;
      input?: unknown;
      state?: string;
    };
    const isToolPart = (part: unknown): part is ToolPart => {
      if (typeof part !== 'object' || part === null) return false;
      const p = part as Record<string, unknown> & {type?: unknown};
      const typeVal =
        typeof p.type === 'string' ? (p.type as string) : undefined;
      return (
        !!typeVal &&
        'toolCallId' in p &&
        (typeVal === 'dynamic-tool' || typeVal.startsWith('tool-'))
      );
    };

    const updatedParts = [...message.parts];
    let sawAnyTool = false;
    for (let i = updatedParts.length - 1; i >= 0; i--) {
      const current = updatedParts[i] as unknown;
      if (!isToolPart(current)) {
        // Stop once we exit the trailing tool region
        if (sawAnyTool) break;
        continue;
      }
      sawAnyTool = true;
      const toolPart = current as ToolPart;
      const hasOutput = toolPart.state?.startsWith('output');
      if (hasOutput) {
        // Completed tool; continue checking earlier parts just in case
        continue;
      }

      // Synthesize a completed error result for the incomplete tool call
      const base = {
        toolCallId: toolPart.toolCallId,
        state: 'output-error' as const,
        input: toolPart.input ?? {},
        errorText: TOOL_CALL_CANCELLED,
        providerExecuted: false,
      };

      const syntheticPart =
        toolPart.type === 'dynamic-tool'
          ? {
              type: 'dynamic-tool' as const,
              toolName: toolPart.toolName || 'unknown',
              ...base,
            }
          : {type: toolPart.type as string, ...base};

      updatedParts[i] =
        syntheticPart as unknown as (typeof message.parts)[number];
    }

    return {
      ...message,
      parts: updatedParts,
    };
  });
}
