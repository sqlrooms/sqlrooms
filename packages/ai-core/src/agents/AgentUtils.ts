import {StoreApi} from '@sqlrooms/room-store';
import {AiSliceState} from '../AiSlice';
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
 * Updates the additional data for an agent tool call.
 */
export function updateAgentToolCallData(params: {
  store: StoreApi<AiSliceState>;
  parentToolCallId: string;
  agentToolCalls: AgentToolCall[];
  sessionId: string;
  finalOutput?: string;
}): void {
  const {store, parentToolCallId, agentToolCalls, sessionId, finalOutput} =
    params;
  const state = store.getState();
  state.ai.setSessionToolAdditionalData(sessionId, parentToolCallId, {
    agentToolCalls: [...agentToolCalls],
    finalOutput,
    timestamp: new Date().toISOString(),
  } as AgentToolCallAdditionalData);
}

/**
 * Processes an agent stream result, tracking tool calls and forwarding chunks to the writer
 *
 * This function handles:
 * - Tracking all tool calls made by the agent
 * - Updating session additional data for UI progress rendering
 * - Forwarding text deltas and tool outputs to the stream writer
 * - Returning the final text result
 *
 * @param agentResult - The stream result from agent.stream()
 * @param store - The store containing AiSliceState
 * @param parentToolCallId - The tool call ID of the parent agent tool (for storing additional data)
 * @param sessionId - The session ID to use for storing additional data
 * @param abortSignal - The abort signal to use for cancelling the stream
 * @returns The final text output from the agent
 */
export async function processAgentStream(
  agentResult: AgentStreamResult,
  store: StoreApi<AiSliceState>,
  parentToolCallId: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  const sessionId = store.getState().ai.getToolCallSession?.(parentToolCallId);

  if (!sessionId) {
    throw new Error('Session ID not found');
  }

  const throwIfAborted = () => {
    if (abortSignal?.aborted) {
      throw new ToolAbortError(TOOL_CALL_CANCELLED);
    }
  };

  const agentToolCalls: AgentToolCall[] = [];

  // Keep track of tool calls by ID for updating state
  const toolCallMap = new Map<string, number>();
  const finalOutput = undefined;

  try {
    for await (const chunk of agentResult.toUIMessageStream()) {
      throwIfAborted();
      // Capture tool input (when agent starts calling a tool)
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

        updateAgentToolCallData({
          store,
          parentToolCallId,
          agentToolCalls,
          sessionId,
          finalOutput,
        });
      }

      // Forward text deltas to writer stream
      if (chunk.type === 'tool-output-available' && chunk.toolCallId) {
        // Update the tool call with success state
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

            updateAgentToolCallData({
              store,
              parentToolCallId,
              agentToolCalls,
              sessionId,
              finalOutput,
            });
          }
        }
      } else if (chunk.type === 'tool-output-error' && chunk.toolCallId) {
        // Update the tool call with error state
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

            updateAgentToolCallData({
              store,
              parentToolCallId,
              agentToolCalls,
              sessionId,
              finalOutput,
            });
          }
        }
      }
    }
  } catch (err) {
    // If we were cancelled, normalize to ToolAbortError so upstream shows "cancelled by user"
    throwIfAborted();
    throw err;
  }

  throwIfAborted();
  // Await the text promise (this also consumes the stream)
  const resultText = await agentResult.text;

  // Store final additional data with all tool calls
  updateAgentToolCallData({
    store,
    parentToolCallId,
    agentToolCalls,
    sessionId,
    finalOutput: resultText,
  });

  return resultText;
}
