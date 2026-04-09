/**
 * Utility functions for AI Chat UI configuration
 */

import {
  AiSettingsSliceConfig,
  AnalysisResultSchema,
  AnalysisSessionSchema,
  DynamicToolUIPart,
  ToolUIPart,
  UIMessagePart,
} from '@sqlrooms/ai-config';
import {
  TextUIPart,
  UIMessage,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
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
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, ToolAbortError);
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
 * Recursively strips `agentToolCalls` from an object so sub-agent
 * tool-call trees don't bloat the LLM context window. Keeps `finalOutput`
 * and other scalar fields intact.
 */
function stripAgentToolCalls(output: unknown): unknown {
  if (!output || typeof output !== 'object') return output;
  if (Array.isArray(output)) return output.map(stripAgentToolCalls);

  const obj = output as Record<string, unknown>;
  if (!('agentToolCalls' in obj)) return output;

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'agentToolCalls') continue;
    cleaned[key] = stripAgentToolCalls(value);
  }
  return cleaned;
}

/**
 * Sanitizes UIMessages before sending to LLM APIs to prevent errors from malformed content.
 *
 * This handles issues that can occur when conversations are interrupted mid-stream:
 * - Empty text parts (causes Bedrock error: "text field in ContentBlock is blank")
 * - Assistant messages with no meaningful content after cleanup
 * - Nested `agentToolCalls` in tool outputs that bloat the LLM context
 *
 * @param messages - The messages to sanitize
 * @returns Sanitized messages safe to send to LLM APIs
 */
export function sanitizeMessagesForLLM(messages: UIMessage[]): UIMessage[] {
  return messages
    .map((message) => {
      if (!message.parts || message.parts.length === 0) {
        return message;
      }

      // Filter out empty text parts and empty reasoning parts,
      // and strip agentToolCalls from tool outputs
      const sanitizedParts = message.parts
        .filter((part) => {
          if (part.type === 'text') {
            const textPart = part as {type: 'text'; text: string};
            return textPart.text && textPart.text.trim().length > 0;
          }
          if (part.type === 'reasoning') {
            const reasoningPart = part as {type: 'reasoning'; text: string};
            return reasoningPart.text && reasoningPart.text.trim().length > 0;
          }
          return true;
        })
        .map((part) => {
          const p = part as Record<string, unknown>;
          if (
            p.state === 'output-available' &&
            p.output &&
            typeof p.output === 'object' &&
            'agentToolCalls' in (p.output as Record<string, unknown>)
          ) {
            return {...part, output: stripAgentToolCalls(p.output)};
          }
          return part;
        }) as typeof message.parts;

      // If all parts were filtered out, add a placeholder for assistant messages
      // to maintain conversation structure (user messages should always have content)
      if (sanitizedParts.length === 0 && message.role === 'assistant') {
        return {
          ...message,
          parts: [{type: 'text' as const, text: '[Response interrupted]'}],
        };
      }

      return {
        ...message,
        parts: sanitizedParts,
      };
    })
    .filter((message) => {
      // Remove messages that have no parts (shouldn't happen after above logic, but safety check)
      return message.parts && message.parts.length > 0;
    });
}

/**
 * Determines whether the analysis should end based on completed messages.
 *
 * The analysis should continue (return false) when the last assistant message
 * has tool calls that the agent loop needs to process. It should end (return true)
 * when the assistant has finished responding with no pending tool work.
 *
 * @param messages - The completed messages to evaluate
 * @returns True if the analysis should end, false if it should continue
 */
export function shouldEndAnalysis(messages: UIMessage[]): boolean {
  const shouldAutoSendNext = lastAssistantMessageIsCompleteWithToolCalls({
    messages,
  });

  const lastMessage = messages[messages.length - 1];
  const isLastMessageAssistant = lastMessage?.role === 'assistant';

  let tailHasTool = false;
  if (isLastMessageAssistant) {
    const parts = lastMessage?.parts ?? [];
    // Find the last step-start boundary to inspect only the final step's parts
    let lastStepStartIndex = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i]?.type === 'step-start') {
        lastStepStartIndex = i;
        break;
      }
    }
    const tailParts = parts.slice(lastStepStartIndex + 1);
    tailHasTool = tailParts.some(
      (part) =>
        typeof part?.type === 'string' &&
        (part.type.startsWith('tool-') || part.type === 'dynamic-tool'),
    );
  }

  return (
    (isLastMessageAssistant && !shouldAutoSendNext && !tailHasTool) ||
    (!shouldAutoSendNext && !isLastMessageAssistant)
  );
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
      const isCompleted =
        toolPart.state?.startsWith('output') ||
        toolPart.state === 'approval-requested' ||
        toolPart.state === 'approval-responded';
      if (isCompleted) {
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

// ---------------------------------------------------------------------------
// Tool name helpers
// ---------------------------------------------------------------------------

const KNOWN_ACRONYMS = new Set(['fsq', 'h3', 'api', 'sql', 'ui', 'csv', 'db']);

/**
 * Humanize a tool name like "agent-fsq-visits-chart" → "FSQ Visits Chart".
 * Strips common prefixes (agent-, skill-) and title-cases each word,
 * auto-uppercasing known acronyms.
 */
export function humanizeToolName(toolName: string): string {
  const stripped = toolName.replace(/^agent-/, '').replace(/^skill-/, '');
  return stripped
    .split(/[-_]+/)
    .map((w) =>
      KNOWN_ACRONYMS.has(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ');
}

// ---------------------------------------------------------------------------
// Shared reasoning-box title generation
// ---------------------------------------------------------------------------

/**
 * Normalized summary of a tool call, used by generateReasoningTitle.
 * Both UIMessagePart and AgentToolCall should be mapped to this shape.
 */
export type ToolCallSummary = {
  toolName: string;
  completed: boolean;
  reasoning?: string;
};

/**
 * Descriptor returned by generateReasoningTitle.
 * - `agent` / `skill`: single-call identity label, render as "Agent · Name"
 * - `running`: reasoning text or "Thinking..." fallback
 * - `completed`: descriptive summary with tool names and optional reasoning
 */
export type ReasoningTitleDescriptor =
  | {kind: 'agent' | 'skill'; humanName: string}
  | {kind: 'running'; text: string}
  | {kind: 'completed'; text: string; toolNames?: string[]; reasoning?: string};

/**
 * Generate a title descriptor for a ReasoningBox given a list of tool call summaries.
 *
 * Handles three categories:
 *  - **Agent / Skill** (single-tool groups): identity label
 *  - **Running tools**: reasoning from the last call, or "Thinking..."
 *  - **Completed tools**: descriptive summary with tool names and reasoning
 */
export function generateReasoningTitle(
  calls: ToolCallSummary[],
  isRunning: boolean,
): ReasoningTitleDescriptor {
  if (calls.length === 0) {
    return {kind: 'completed', text: 'Worked'};
  }

  const firstCall = calls[0]!;
  const isAgent = firstCall.toolName.startsWith('agent-');
  const isSkill = firstCall.toolName.startsWith('skill-');

  if ((isAgent || isSkill) && calls.length === 1) {
    return {
      kind: isAgent ? 'agent' : 'skill',
      humanName: humanizeToolName(firstCall.toolName),
    };
  }

  const count = calls.length;

  if (isRunning) {
    const lastCall = calls[calls.length - 1]!;
    return {
      kind: 'running',
      text:
        lastCall.reasoning ||
        (count === 1 ? 'Thinking...' : `Thinking... (${count} tools)`),
    };
  }

  const humanNames = [
    ...new Set(calls.map((c) => humanizeToolName(c.toolName))),
  ];
  const lastReasoning = findLastReasoning(calls);

  let text: string;
  if (count === 1) {
    text = lastReasoning ?? `Used ${humanNames[0]}`;
  } else if (lastReasoning) {
    text =
      count === 2
        ? `${lastReasoning} (+1 more)`
        : `${lastReasoning} (+${count - 1} more)`;
  } else {
    const MAX_NAMES = 3;
    const shown = humanNames.slice(0, MAX_NAMES).join(', ');
    text =
      humanNames.length > MAX_NAMES ? `Used ${shown}, ...` : `Used ${shown}`;
  }

  return {
    kind: 'completed',
    text,
    toolNames: humanNames,
    reasoning: lastReasoning,
  };
}

function findLastReasoning(calls: ToolCallSummary[]): string | undefined {
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i]!.reasoning) return calls[i]!.reasoning;
  }
  return undefined;
}
