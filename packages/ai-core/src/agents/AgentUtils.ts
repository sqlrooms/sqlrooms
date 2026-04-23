import {ToolLoopAgent, ToolSet, UIMessageChunk, createAgentUIStream} from 'ai';
import {ToolAbortError} from '../utils';
import {TOOL_CALL_CANCELLED} from '../constants';
import type {
  AgentProgressSnapshot,
  AgentStreamOutput,
  AgentToolCall,
  PendingSubAgentApproval,
} from '../types';

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
      requestSubAgentApproval?: (approval: PendingSubAgentApproval) => void;
      resolveSubAgentApproval?: (approvalId: string, approved: boolean) => void;
      clearSubAgentApproval?: (approvalId: string) => void;
      writeAbortSnapshot?: (
        toolCallId: string,
        snapshot: AgentProgressSnapshot,
      ) => void;
      readAbortSnapshot?: (
        toolCallId: string,
      ) => AgentProgressSnapshot | undefined;
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
      input: chunk.input,
      state: 'pending',
    });
  } else if (chunk.type === 'tool-output-available') {
    const existing = toolEditState.get(chunk.toolCallId);
    if (existing) {
      existing.output = chunk.output;
      existing.state = 'success';
      const nested = extractNestedAgentToolCalls(chunk.output);
      if (nested) {
        existing.agentToolCalls = nested;
      }
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
 * If a tool output looks like it came from a nested agent (contains agentToolCalls),
 * extract and return those calls so the parent can embed them for recursive rendering.
 */
function extractNestedAgentToolCalls(
  output: unknown,
): AgentToolCall[] | undefined {
  if (
    output &&
    typeof output === 'object' &&
    'agentToolCalls' in output &&
    Array.isArray((output as {agentToolCalls: unknown}).agentToolCalls)
  ) {
    return (output as {agentToolCalls: AgentToolCall[]}).agentToolCalls;
  }
  return undefined;
}

const MAX_OUTPUT_SUMMARY_LENGTH = 200;

/**
 * Truncate a tool output to a short summary suitable for LLM context.
 */
function summarizeOutput(output: unknown): unknown {
  if (output == null) return output;
  try {
    const str = typeof output === 'string' ? output : JSON.stringify(output);
    if (str.length <= MAX_OUTPUT_SUMMARY_LENGTH) return output;
    return str.slice(0, MAX_OUTPUT_SUMMARY_LENGTH) + '...';
  } catch {
    return '[output too large to summarize]';
  }
}

/**
 * Transition any tool calls still in `pending` or `approval-requested` state
 * to `error` with the cancellation message. Clears `approvalId` on the
 * approval-requested path so downstream consumers don't act on a stale id.
 */
function markPendingToolCallsAsCancelled(
  toolCallMap: Map<string, AgentToolCall>,
): void {
  const now = Date.now();
  for (const [id, tc] of toolCallMap) {
    if (tc.state === 'pending' || tc.state === 'approval-requested') {
      toolCallMap.set(id, {
        ...tc,
        state: 'error',
        errorText: TOOL_CALL_CANCELLED,
        completedAt: now,
        approvalId: undefined,
      });
    }
  }
}

/**
 * Build an `AgentProgressSnapshot` from the current `toolCallMap` state.
 * For any entry whose `toolName` starts with `agent-`, reads the child's
 * abort snapshot from the store (written by the child's `streamSubAgent`
 * before it threw) and embeds it as `childSnapshot`.
 */
function buildAbortSnapshot(
  agentName: string,
  toolCallMap: Map<string, AgentToolCall>,
  finalText: string,
  store: AgentStreamStore,
): AgentProgressSnapshot {
  const completedTools: AgentProgressSnapshot['completedTools'] = [];
  const failedTools: AgentProgressSnapshot['failedTools'] = [];
  const pendingTools: AgentProgressSnapshot['pendingTools'] = [];

  for (const tc of toolCallMap.values()) {
    const childSnapshot = store
      .getState()
      .ai.readAbortSnapshot?.(tc.toolCallId);

    if (tc.state === 'success') {
      completedTools.push({
        toolName: tc.toolName,
        input: tc.input,
        output: summarizeOutput(tc.output),
        ...(childSnapshot ? {childSnapshot} : {}),
      });
    } else if (tc.state === 'error') {
      failedTools.push({
        toolName: tc.toolName,
        input: tc.input,
        errorText: tc.errorText || 'unknown',
        ...(childSnapshot ? {childSnapshot} : {}),
      });
    } else {
      pendingTools.push({
        toolName: tc.toolName,
        input: tc.input,
        ...(childSnapshot ? {childSnapshot} : {}),
      });
    }
  }

  return {
    agentName,
    completedTools,
    failedTools,
    pendingTools,
    partialText: finalText,
  };
}

/**
 * Format an `AgentProgressSnapshot` into a human-readable string
 * that can be embedded in error text for LLM visibility.
 * Recurses into `childSnapshot` to render arbitrarily deep nesting.
 */
export function formatAbortSnapshot(
  snapshot: AgentProgressSnapshot,
  indent: string = '',
): string {
  const lines: string[] = [];

  for (const t of snapshot.completedTools) {
    const inputStr = t.input != null ? JSON.stringify(t.input) : '';
    const outputStr =
      t.output != null
        ? ` -> ${typeof t.output === 'string' ? t.output : JSON.stringify(t.output)}`
        : '';
    lines.push(`${indent}- Completed: ${t.toolName}(${inputStr})${outputStr}`);
    if (t.childSnapshot) {
      lines.push(formatAbortSnapshot(t.childSnapshot, indent + '  '));
    }
  }
  for (const t of snapshot.failedTools) {
    lines.push(`${indent}- Failed: ${t.toolName} (${t.errorText})`);
    if (t.childSnapshot) {
      lines.push(formatAbortSnapshot(t.childSnapshot, indent + '  '));
    }
  }
  for (const t of snapshot.pendingTools) {
    const inputStr = t.input != null ? JSON.stringify(t.input) : '';
    lines.push(`${indent}- Pending: ${t.toolName}(${inputStr})`);
    if (t.childSnapshot) {
      lines.push(formatAbortSnapshot(t.childSnapshot, indent + '  '));
    }
  }

  if (snapshot.partialText) {
    const truncated =
      snapshot.partialText.length > 200
        ? snapshot.partialText.slice(0, 200) + '...'
        : snapshot.partialText;
    lines.push(`${indent}- Partial response: ${truncated}`);
  }

  return lines.join('\n');
}

/**
 * Streams a sub-agent with the given prompt, collecting tool call progress for
 * live UI rendering via the store, and returns the final text output along with
 * the collected tool calls.
 *
 * When a tool with `needsApproval` is encountered, the stream pauses, surfaces
 * an approval request through the store, waits for the user's response, then
 * restarts the stream with the approval response so the agent loop can continue.
 *
 * @param agent - The ToolLoopAgent to run
 * @param prompt - The prompt string to send to the agent
 * @param store - Store providing updateAgentProgress / clearAgentProgress / approval methods
 * @param parentToolCallId - The parent tool call ID for progress tracking
 * @param abortSignal - Optional abort signal for cancellation
 * @returns The final text and collected tool calls from the agent
 */
export async function streamSubAgent<TOOLS extends ToolSet = ToolSet>(
  agent: ToolLoopAgent<never, TOOLS, any>,
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

  // Build the initial uiMessages for the agent stream
  let uiMessages: Array<{
    id: string;
    role: 'user' | 'assistant';
    parts: Array<Record<string, unknown>>;
  }> = [
    {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{type: 'text', text: prompt}],
    },
  ];

  // Approval retry loop: re-create the stream after each approval response
  while (true) {
    throwIfAborted();

    let pendingApproval: {
      approvalId: string;
      toolCallId: string;
    } | null = null;

    const stream = await createAgentUIStream({
      agent,
      uiMessages,
      abortSignal,
    });

    // Accumulated assistant tool parts for the current stream iteration,
    // keyed by toolCallId. If the stream ends with a pending approval we
    // reconstruct the conversation from these so the next iteration sees
    // the approval response in context.
    const assistantToolParts = new Map<
      string,
      {toolCallId: string; toolName: string; input: unknown; output?: unknown}
    >();

    try {
      for await (const chunk of stream) {
        throwIfAborted();

        if (chunk.type === 'text-delta') {
          finalText += chunk.delta;
        }

        // Handle tool-approval-request chunks from the AI SDK
        if (
          chunk.type === 'tool-approval-request' &&
          'approvalId' in chunk &&
          'toolCallId' in chunk
        ) {
          const approvalChunk = chunk as {
            type: 'tool-approval-request';
            approvalId: string;
            toolCallId: string;
          };
          pendingApproval = {
            approvalId: approvalChunk.approvalId,
            toolCallId: approvalChunk.toolCallId,
          };

          // Update the tool call entry to show approval-requested state
          const entry = toolCallMap.get(approvalChunk.toolCallId);
          if (entry) {
            toolCallMap.set(approvalChunk.toolCallId, {
              ...entry,
              state: 'approval-requested',
              approvalId: approvalChunk.approvalId,
            });
            pushProgress();
          }
          continue;
        }

        // Track assistant tool parts for conversation reconstruction
        if (chunk.type === 'tool-input-available') {
          assistantToolParts.set((chunk as any).toolCallId, {
            toolCallId: (chunk as any).toolCallId,
            toolName: (chunk as any).toolName,
            input: (chunk as any).input,
          });
        }

        if (!('toolCallId' in chunk) || !chunk.toolCallId) continue;

        const id = chunk.toolCallId;
        let changed = false;

        if (!toolCallMap.has(id) && 'toolName' in chunk && chunk.toolName) {
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

        if (chunk.type === 'tool-input-available') {
          toolCallMap.set(id, {...entry, input: chunk.input});
          changed = true;
        } else if (chunk.type === 'tool-output-available') {
          const nestedCalls = extractNestedAgentToolCalls(chunk.output);
          toolCallMap.set(id, {
            ...entry,
            output: chunk.output,
            state: 'success',
            completedAt: Date.now(),
            ...(nestedCalls ? {agentToolCalls: nestedCalls} : {}),
          });
          changed = true;

          // Merge output into the tool part for conversation reconstruction
          const tp = assistantToolParts.get(id);
          if (tp) {
            tp.output = chunk.output;
          }
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
        } else if (chunk.type === 'tool-output-denied') {
          toolCallMap.set(id, {
            ...entry,
            state: 'error',
            errorText: 'Denied by user',
            completedAt: Date.now(),
          });
          changed = true;
        }

        if (changed) {
          pushProgress();
        }
      }
    } catch (err) {
      if (abortSignal?.aborted) {
        markPendingToolCallsAsCancelled(toolCallMap);
        const snapshot = buildAbortSnapshot(
          parentToolCallId,
          toolCallMap,
          finalText,
          store,
        );
        store.getState().ai.writeAbortSnapshot?.(parentToolCallId, snapshot);
        pushProgress();
        throw new ToolAbortError(TOOL_CALL_CANCELLED, snapshot);
      }
      throw err;
    }

    // If no approval was requested, we're done
    if (!pendingApproval) {
      break;
    }

    // Surface the approval request to the UI and wait for the user's response
    const approvedEntry = toolCallMap.get(pendingApproval.toolCallId);
    if (!approvedEntry || !store.getState().ai.requestSubAgentApproval) {
      break;
    }

    const approved = await new Promise<boolean>((resolve) => {
      throwIfAborted();
      store.getState().ai.requestSubAgentApproval!({
        toolCallId: pendingApproval!.toolCallId,
        approvalId: pendingApproval!.approvalId,
        toolName: approvedEntry.toolName,
        input: approvedEntry.input,
        resolve,
      });
    });

    throwIfAborted();

    // Clean up the pending approval from the store
    store.getState().ai.clearSubAgentApproval?.(pendingApproval.approvalId);

    // Update tool call state based on user's response
    if (approved) {
      toolCallMap.set(pendingApproval.toolCallId, {
        ...approvedEntry,
        state: 'pending',
        approvalId: undefined,
      });
    } else {
      toolCallMap.set(pendingApproval.toolCallId, {
        ...approvedEntry,
        state: 'error',
        errorText: 'Denied by user',
        approvalId: undefined,
      });
    }
    pushProgress();

    // Reconstruct the messages for the next stream iteration.
    // Each tool part becomes a single `tool-<name>` part. Completed tools
    // get `output-available` state; the approval target gets the approval
    // response so the agent loop can continue from where it left off.
    const assistantMessage = {
      id: crypto.randomUUID(),
      role: 'assistant' as const,
      parts: Array.from(assistantToolParts.values()).map((tp) => {
        const isApprovalTarget = tp.toolCallId === pendingApproval!.toolCallId;

        if (isApprovalTarget) {
          return {
            type: `tool-${tp.toolName}` as string,
            toolCallId: tp.toolCallId,
            toolName: tp.toolName,
            input: tp.input,
            state: approved ? 'approval-responded' : 'output-denied',
            approval: {
              id: pendingApproval!.approvalId,
              approved,
            },
          };
        }

        return {
          type: `tool-${tp.toolName}` as string,
          toolCallId: tp.toolCallId,
          toolName: tp.toolName,
          input: tp.input,
          output: tp.output,
          state: 'output-available' as const,
        };
      }),
    };

    uiMessages = [...uiMessages, assistantMessage];
  }

  // Push final completed state so the UI can render after the tool finishes.
  // We intentionally do NOT clear agentProgress here — the data persists so
  // AgentProgressSection can render nested tool calls from the store instead
  // of relying on agentToolCalls embedded in the tool output (which would
  // bloat the main orchestrator's message context).
  if (abortSignal?.aborted) {
    markPendingToolCallsAsCancelled(toolCallMap);
  }

  pushProgress();

  if (abortSignal?.aborted) {
    const snapshot = buildAbortSnapshot(
      parentToolCallId,
      toolCallMap,
      finalText,
      store,
    );
    store.getState().ai.writeAbortSnapshot?.(parentToolCallId, snapshot);
    throw new ToolAbortError(TOOL_CALL_CANCELLED, snapshot);
  }

  return {
    finalOutput: finalText,
    agentToolCalls: Array.from(toolCallMap.values()),
  };
}
