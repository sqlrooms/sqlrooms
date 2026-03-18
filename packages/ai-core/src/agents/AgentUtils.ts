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
 * Additional data stored for an agent tool call to track progress
 */
export type AgentToolCallAdditionalData = {
  agentToolCalls: AgentToolCall[];
  finalOutput?: string;
  timestamp: string;
};

/**
 * @deprecated This function is a no-op. Agent progress is now tracked
 * only locally inside {@link processAgentStream} and returned as part
 * of the tool output.
 */
export function updateAgentToolCallData(_params: {
  store: unknown;
  parentToolCallId: string;
  agentToolCalls: AgentToolCall[];
  sessionId: string;
  finalOutput?: string;
}): void {
  // no-op — in-chat tool result editing has been removed
}

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
 * Processes an agent stream result, tracking tool calls and forwarding chunks.
 *
 * This function handles:
 * - Tracking all tool calls made by the agent
 * - Forwarding text deltas and tool outputs to the stream writer
 * - Returning the final text result
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

  const agentToolCalls: AgentToolCall[] = [];
  const toolCallMap = new Map<string, number>();

  try {
    for await (const chunk of agentResult.toUIMessageStream()) {
      throwIfAborted();

      if (
        chunk.type === 'tool-input-available' &&
        chunk.toolCallId &&
        chunk.toolName
      ) {
        const index = agentToolCalls.length;
        toolCallMap.set(chunk.toolCallId, index);
        agentToolCalls.push({
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          state: 'pending',
        });
      }

      if (chunk.type === 'tool-output-available' && chunk.toolCallId) {
        const index = toolCallMap.get(chunk.toolCallId);
        if (index !== undefined) {
          const toolCall = agentToolCalls[index];
          if (toolCall) {
            agentToolCalls[index] = {
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              output: chunk.output,
              state: 'success',
            };
          }
        }
      } else if (chunk.type === 'tool-output-error' && chunk.toolCallId) {
        const index = toolCallMap.get(chunk.toolCallId);
        if (index !== undefined) {
          const toolCall = agentToolCalls[index];
          if (toolCall) {
            agentToolCalls[index] = {
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              errorText: chunk.errorText,
              state: 'error',
            };
          }
        }
      }
    }
  } catch (err) {
    throwIfAborted();
    throw err;
  }

  throwIfAborted();
  const resultText = await agentResult.text;

  return resultText;
}
