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
 * Represents a chunk from the UI message stream.
 * Covers the tool-related subset of the AI SDK's UIMessageChunk union.
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
  startedAt?: number;
  completedAt?: number;
};

/**
 * Return type from processAgentStream containing both final text and tool call data.
 */
export type AgentStreamOutput = {
  finalOutput: string;
  agentToolCalls: AgentToolCall[];
};

/**
 * Minimal store interface required by processAgentStream.
 */
interface AgentStreamStore {
  getState(): {
    ai: {
      getToolCallSession?: (toolCallId: string) => string | undefined;
      updateAgentProgress: (
        parentToolCallId: string,
        toolCalls: AgentToolCall[],
      ) => void;
      clearAgentProgress: (parentToolCallId: string) => void;
    };
  };
}

/**
 * Processes an agent stream result, collecting tool call information from chunks
 * and returning both the final text and tool call data for UI rendering.
 *
 * @param agentResult - The stream result from agent.stream()
 * @param store - The store (used to resolve the owning session)
 * @param parentToolCallId - The tool call ID of the parent agent tool
 * @param abortSignal - Optional abort signal for cancellation
 * @returns The final text and collected tool calls from the agent
 */
export async function processAgentStream(
  agentResult: AgentStreamResult,
  store: AgentStreamStore,
  parentToolCallId: string,
  abortSignal?: AbortSignal,
): Promise<AgentStreamOutput> {
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

  const toolCallMap = new Map<string, AgentToolCall>();

  const pushProgress = () => {
    store.getState().ai.updateAgentProgress(
      parentToolCallId,
      Array.from(toolCallMap.values()).map((tc) => ({...tc})),
    );
  };

  try {
    for await (const chunk of agentResult.toUIMessageStream()) {
      throwIfAborted();

      if (!chunk.toolCallId) continue;

      const id = chunk.toolCallId;
      let changed = false;

      if (!toolCallMap.has(id) && chunk.toolName) {
        toolCallMap.set(id, {
          toolCallId: id,
          toolName: chunk.toolName,
          state: 'pending',
          startedAt: Date.now(),
        });
        changed = true;
      }

      const entry = toolCallMap.get(id);
      if (!entry) continue;

      if (chunk.type === 'tool-output-available') {
        toolCallMap.set(id, {
          ...entry,
          output: chunk.output,
          state: 'success',
          completedAt: Date.now(),
        });
        changed = true;
      } else if (
        chunk.type === 'tool-output-error' ||
        chunk.type === 'tool-input-error'
      ) {
        toolCallMap.set(id, {
          ...entry,
          errorText: chunk.errorText,
          state: 'error',
          completedAt: Date.now(),
        });
        changed = true;
      }

      if (changed) {
        pushProgress();
      }
    }
  } catch (err) {
    throwIfAborted();
    throw err;
  } finally {
    store.getState().ai.clearAgentProgress(parentToolCallId);
  }

  throwIfAborted();
  const finalOutput = await agentResult.text;

  return {
    finalOutput,
    agentToolCalls: Array.from(toolCallMap.values()),
  };
}
