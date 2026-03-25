import {ToolLoopAgent, ToolSet, UIMessageChunk, createAgentUIStream} from 'ai';
import {ToolAbortError} from '../utils';
import {TOOL_CALL_CANCELLED} from '../constants';

/**
 * Represents the state of a single tool call made by an agent
 */
export type AgentToolCall = {
  toolCallId: string;
  toolName: string;
  output?: unknown;
  errorText?: string;
  state: 'pending' | 'success' | 'error';
};

/**
 * Additional data associated with an agent tool call, used by renderers.
 */
export type AgentToolCallAdditionalData = {
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

/**
 * Updates a tool call entry in the provided toolEditState map based on a stream chunk.
 * Used by renderers to track per-tool-call progress.
 *
 * @param toolEditState - Mutable map of toolCallId to AgentToolCall
 * @param chunk - A UIMessageChunk from the agent stream
 */
export function updateAgentToolCallData(
  toolEditState: Map<string, AgentToolCall>,
  chunk: UIMessageChunk,
): void {
  if (chunk.type === 'tool-input-available') {
    toolEditState.set(chunk.toolCallId, {
      toolCallId: chunk.toolCallId,
      toolName: chunk.toolName,
      state: 'pending',
    });
  } else if (chunk.type === 'tool-output-available') {
    const existing = toolEditState.get(chunk.toolCallId);
    if (existing) {
      existing.output = chunk.output;
      existing.state = 'success';
    }
  } else if (chunk.type === 'tool-output-error') {
    const existing = toolEditState.get(chunk.toolCallId);
    if (existing) {
      existing.errorText = chunk.errorText;
      existing.state = 'error';
    }
  } else if (chunk.type === 'tool-input-error') {
    toolEditState.set(chunk.toolCallId, {
      toolCallId: chunk.toolCallId,
      toolName: chunk.toolName,
      errorText: chunk.errorText,
      state: 'error',
    });
  }
}

/**
 * Streams a sub-agent with the given prompt, iterating chunks to update tool call
 * progress, and returns the final text output.
 *
 * @param agent - The ToolLoopAgent to run
 * @param prompt - The prompt string to send to the agent
 * @param abortSignal - Optional abort signal for cancellation
 * @returns The final text output from the agent
 */
export async function streamSubAgent<TOOLS extends ToolSet = ToolSet>(
  agent: ToolLoopAgent<never, TOOLS, never>,
  prompt: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  const throwIfAborted = () => {
    if (abortSignal?.aborted) {
      throw new ToolAbortError(TOOL_CALL_CANCELLED);
    }
  };

  let finalText = '';

  const stream = await createAgentUIStream({
    agent,
    uiMessages: [
      {
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{type: 'text', text: prompt}],
      },
    ],
    abortSignal,
  });

  try {
    for await (const chunk of stream) {
      throwIfAborted();
      if (chunk.type === 'text-delta') {
        finalText += chunk.delta;
      }
    }
  } catch (err) {
    throwIfAborted();
    throw err;
  }

  throwIfAborted();
  return finalText;
}
