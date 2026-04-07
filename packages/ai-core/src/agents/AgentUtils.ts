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
 * Return type from streamSubAgent containing both final text and tool call data.
 */
export type AgentStreamOutput = {
  finalOutput: string;
  agentToolCalls: AgentToolCall[];
};

/**
 * Minimal store interface required by streamSubAgent.
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
    } else {
      console.warn(
        `Received tool-output-available for unknown toolCallId: ${chunk.toolCallId}`,
      );
    }
  } else if (chunk.type === 'tool-output-error') {
    const existing = toolEditState.get(chunk.toolCallId);
    if (existing) {
      existing.errorText = chunk.errorText;
      existing.state = 'error';
    } else {
      console.warn(
        `Received tool-output-error for unknown toolCallId: ${chunk.toolCallId}`,
      );
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
 * Streams a sub-agent with the given prompt, collecting tool call progress for
 * live UI rendering via the store, and returns the final text output along with
 * the collected tool calls.
 *
 * @param agent - The ToolLoopAgent to run
 * @param prompt - The prompt string to send to the agent
 * @param store - Store providing updateAgentProgress / clearAgentProgress
 * @param parentToolCallId - The parent tool call ID for progress tracking
 * @param abortSignal - Optional abort signal for cancellation
 * @returns The final text and collected tool calls from the agent
 */
export async function streamSubAgent<TOOLS extends ToolSet = ToolSet>(
  agent: ToolLoopAgent<never, TOOLS, never>,
  prompt: string,
  store: AgentStreamStore,
  parentToolCallId: string,
  abortSignal?: AbortSignal,
): Promise<AgentStreamOutput> {
  const throwIfAborted = () => {
    if (abortSignal?.aborted) {
      throw new ToolAbortError(TOOL_CALL_CANCELLED);
    }
  };

  let finalText = '';
  const toolCallMap = new Map<string, AgentToolCall>();

  const pushProgress = () => {
    store.getState().ai.updateAgentProgress(
      parentToolCallId,
      Array.from(toolCallMap.values()).map((tc) => ({...tc})),
    );
  };

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

      if (!chunk.toolCallId) continue;

      const id = chunk.toolCallId;
      let changed = false;

      if (!toolCallMap.has(id) && chunk.toolName) {
        toolCallMap.set(id, {
          toolCallId: id,
          toolName: chunk.toolName,
          state: 'pending',
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

  return {
    finalOutput: finalText,
    agentToolCalls: Array.from(toolCallMap.values()),
  };
}
