import {ToolAbortError} from '../utils';
import {TOOL_CALL_CANCELLED} from '../constants';

/**
 * Type definition for agent stream result (from ai package)
 * Represents the return value of Agent.stream()
 */
export type AgentStreamResult = {
  toUIMessageStream(): AsyncIterable<UIMessageChunk>;
  text: Promise<string>;
};

/**
 * Represents a chunk from the UI message stream
 */
export type UIMessageChunk = {
  type: string;
  toolCallId?: string;
  toolName?: string;
  output?: unknown;
  errorText?: string;
  delta?: string;
  id?: string;
  providerMetadata?: unknown;
};

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
 * Minimal store interface required by processAgentStream.
 */
interface AgentStreamStore {
  getState(): {
    ai: {
      getToolCallSession?: (toolCallId: string) => string | undefined;
    };
  };
}

/**
 * Processes an agent stream result, consuming chunks and returning the final text.
 *
 * @param agentResult - The stream result from agent.stream()
 * @param store - The store (used to resolve the owning session)
 * @param parentToolCallId - The tool call ID of the parent agent tool
 * @param abortSignal - Optional abort signal for cancellation
 * @returns The final text output from the agent
 */
export async function processAgentStream(
  agentResult: AgentStreamResult,
  store: AgentStreamStore,
  parentToolCallId: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  const sessionId = store.getState().ai.getToolCallSession?.(parentToolCallId);

  if (!sessionId) {
    throw new Error(
      `Session ID not found for tool call "${parentToolCallId}". The tool may have been called outside of a valid session context.`,
    );
  }

  const throwIfAborted = () => {
    if (abortSignal?.aborted) {
      throw new ToolAbortError(TOOL_CALL_CANCELLED);
    }
  };

  try {
    for await (const _chunk of agentResult.toUIMessageStream()) {
      throwIfAborted();
    }
  } catch (err) {
    throwIfAborted();
    throw err;
  }

  throwIfAborted();
  return await agentResult.text;
}
