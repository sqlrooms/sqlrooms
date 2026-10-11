import type {UIMessage} from 'ai';
import {TOOL_CALL_CANCELLED} from './constants';
import type {
  AgentToolCall,
  PendingSubAgentApproval,
  StoredToolSet,
} from './types';

/** Opt-in timeout limits for chat runs and tool execution. */
export type AiTimeoutOptions = {
  /** Maximum wall-clock time for a complete multi-step chat run. */
  runMs?: number;
  /**
   * Maximum time without an observable UI message update while a run is
   * streaming. Approval waits are excluded.
   */
  idleStreamMs?: number;
  /** Default maximum execution time for an individual tool. */
  toolExecutionMs?: number;
  /**
   * Per-tool overrides. An explicit `undefined` disables the default timeout
   * for that tool.
   */
  tools?: Record<string, number | undefined>;
};

/** Identifies which timeout limit ended an operation. */
export type ChatTimeoutKind = 'run' | 'idle-stream' | 'tool';

/** Error used to distinguish automatic timeouts from manual cancellation. */
export class ChatTimeoutError extends Error {
  constructor(
    public readonly kind: ChatTimeoutKind,
    public readonly timeoutMs: number,
    message: string,
  ) {
    super(message);
    this.name = 'ChatTimeoutError';
  }
}

/** Returns a positive finite timeout, or disables invalid/omitted values. */
export function getConfiguredTimeoutMs(
  timeoutMs: number | undefined,
): number | undefined {
  return typeof timeoutMs === 'number' &&
    Number.isFinite(timeoutMs) &&
    timeoutMs > 0
    ? timeoutMs
    : undefined;
}

/** Resolves a tool-specific timeout before falling back to the default. */
export function getToolExecutionTimeoutMs(
  options: AiTimeoutOptions | undefined,
  toolName: string,
): number | undefined {
  if (
    options?.tools &&
    Object.prototype.hasOwnProperty.call(options.tools, toolName)
  ) {
    return getConfiguredTimeoutMs(options?.tools?.[toolName]);
  }
  return getConfiguredTimeoutMs(options?.toolExecutionMs);
}

/** Creates the error shown when a complete chat run exceeds its limit. */
export function createRunTimeoutError(timeoutMs: number): ChatTimeoutError {
  return new ChatTimeoutError(
    'run',
    timeoutMs,
    `Chat run timed out after ${formatTimeoutDuration(timeoutMs)}`,
  );
}

/** Creates the error shown when observable stream progress stops. */
export function createIdleStreamTimeoutError(
  timeoutMs: number,
): ChatTimeoutError {
  return new ChatTimeoutError(
    'idle-stream',
    timeoutMs,
    `No model or tool progress received for ${formatTimeoutDuration(timeoutMs)}`,
  );
}

/** Creates the error shown when one tool exceeds its execution limit. */
export function createToolTimeoutError(
  toolName: string,
  timeoutMs: number,
): ChatTimeoutError {
  return new ChatTimeoutError(
    'tool',
    timeoutMs,
    `Tool "${toolName}" timed out after ${formatTimeoutDuration(timeoutMs)}`,
  );
}

/** A no-execute client tool call that is waiting for UI-provided output. */
export type PendingClientToolCall = {
  toolName: string;
  toolCallId: string;
};

/** A pending client tool call with its configured timeout. */
export type PendingClientToolTimeout = PendingClientToolCall & {
  timeoutMs: number;
};

/** Controls how pending client-output tool calls are detected. */
export type PendingClientToolCallOptions = {
  /** Registered executable tools that explicitly await client-side output. */
  executableClientToolNames?: readonly string[];
};

/**
 * Finds registered tool calls whose latest state is waiting for client output.
 * Tools without an `execute` function are treated as client tools. Executable
 * tools are included only when their names appear in
 * `executableClientToolNames`, which lets remote transports explicitly declare
 * the executable tools whose output is supplied by the client.
 */
export function getPendingClientToolCalls(
  messages: UIMessage[],
  tools: StoredToolSet,
  options: PendingClientToolCallOptions = {},
): PendingClientToolCall[] {
  const latestParts = getLatestToolParts(messages);

  const pending: PendingClientToolCall[] = [];
  for (const [toolCallId, part] of latestParts) {
    const registeredTool = tools[part.toolName];
    if (
      part.state !== 'input-available' ||
      !registeredTool ||
      (registeredTool.execute &&
        !options.executableClientToolNames?.includes(part.toolName))
    ) {
      continue;
    }
    pending.push({toolCallId, toolName: part.toolName});
  }
  return pending;
}

/**
 * Returns whether the current user turn has a registered executable tool call
 * waiting for execution to finish. This is used by local transports so the
 * per-tool timeout, including an explicitly disabled timeout, remains
 * authoritative while a tool runs silently.
 */
export function hasPendingCurrentTurnExecutableToolCall(
  messages: UIMessage[],
  tools: StoredToolSet,
): boolean {
  let currentTurnStart = 0;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'user') {
      currentTurnStart = index;
      break;
    }
  }
  const currentTurnMessages = messages.slice(currentTurnStart);

  for (const part of getLatestToolParts(currentTurnMessages).values()) {
    if (part.state === 'input-available' && tools[part.toolName]?.execute) {
      return true;
    }
  }
  return false;
}

/** Returns whether the current user turn has a tool awaiting approval. */
export function hasPendingToolApproval(
  messages: UIMessage[] | undefined,
): boolean {
  if (!messages?.length) return false;
  let currentTurnStart = 0;
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'user') {
      currentTurnStart = index;
      break;
    }
  }

  return messages.slice(currentTurnStart).some(
    (message) =>
      message.role === 'assistant' &&
      (message.parts ?? []).some((part) => {
        const type = part.type;
        return (
          (type === 'dynamic-tool' || type.startsWith('tool-')) &&
          (part as {state?: string}).state === 'approval-requested'
        );
      }),
  );
}

/** Finds pending client tools whose opt-in execution timeout is enabled. */
export function getPendingClientToolTimeouts(
  messages: UIMessage[],
  tools: StoredToolSet,
  options: AiTimeoutOptions | undefined,
  clientToolOptions: PendingClientToolCallOptions = {},
): PendingClientToolTimeout[] {
  return getPendingClientToolCalls(messages, tools, clientToolOptions).flatMap(
    (pending) => {
      const timeoutMs = getToolExecutionTimeoutMs(options, pending.toolName);
      return timeoutMs == null ? [] : [{...pending, timeoutMs}];
    },
  );
}

/**
 * Serializes only agent progress reachable from tool-call IDs in the given
 * messages, following nested agent calls recursively. The stable serialization
 * changes when this session's reachable progress changes but ignores progress
 * owned exclusively by other sessions.
 */
export function getSessionAgentProgressSignal(
  messages: UIMessage[],
  agentProgress: Record<string, AgentToolCall[]>,
): string {
  const reachableToolCallIds = getReachableAgentToolCallIds(
    messages,
    agentProgress,
  );

  return JSON.stringify(
    Object.entries(agentProgress)
      .filter(([parentToolCallId]) =>
        reachableToolCallIds.has(parentToolCallId),
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([parentToolCallId, toolCalls]) => [
        parentToolCallId,
        toolCalls.map(getAgentToolCallProgressSignal),
      ]),
  );
}

/** Agent progress and approval IDs that must be completed on session timeout. */
export type TimedOutSessionAgentState = {
  agentProgress: Record<string, AgentToolCall[]>;
  approvalIds: string[];
};

/**
 * Marks pending agent work reachable from a timed-out session as failed and
 * returns the reachable approval IDs that must be released. Progress and
 * approvals owned exclusively by other sessions are left unchanged.
 */
export function getTimedOutSessionAgentState(
  messages: UIMessage[],
  agentProgress: Record<string, AgentToolCall[]>,
  pendingApprovals: Record<string, PendingSubAgentApproval>,
  timeoutMessage: string,
): TimedOutSessionAgentState {
  const reachableToolCallIds = getReachableAgentToolCallIds(
    messages,
    agentProgress,
  );
  return getTimedOutAgentState(
    reachableToolCallIds,
    agentProgress,
    pendingApprovals,
    timeoutMessage,
  );
}

/**
 * Marks agent work reachable from one timed-out tool call as failed and
 * returns approval IDs that must be released.
 */
export function getTimedOutToolAgentState(
  toolCallId: string,
  agentProgress: Record<string, AgentToolCall[]>,
  pendingApprovals: Record<string, PendingSubAgentApproval>,
  timeoutMessage: string,
): TimedOutSessionAgentState {
  return getTimedOutAgentState(
    expandReachableAgentToolCallIds(new Set([toolCallId]), agentProgress),
    agentProgress,
    pendingApprovals,
    timeoutMessage,
  );
}

function getTimedOutAgentState(
  reachableToolCallIds: Set<string>,
  agentProgress: Record<string, AgentToolCall[]>,
  pendingApprovals: Record<string, PendingSubAgentApproval>,
  timeoutMessage: string,
): TimedOutSessionAgentState {
  const approvalIds = new Set<string>();
  const completedAt = Date.now();

  const completeToolCall = (toolCall: AgentToolCall): AgentToolCall => {
    const agentToolCalls = toolCall.agentToolCalls?.map(completeToolCall);
    if (
      toolCall.state === 'pending' ||
      toolCall.state === 'approval-requested' ||
      (toolCall.state === 'error' && toolCall.errorText === TOOL_CALL_CANCELLED)
    ) {
      if (toolCall.approvalId) approvalIds.add(toolCall.approvalId);
      return {
        ...toolCall,
        state: 'error',
        errorText: timeoutMessage,
        approvalId: undefined,
        completedAt,
        ...(agentToolCalls ? {agentToolCalls} : {}),
      };
    }
    return agentToolCalls ? {...toolCall, agentToolCalls} : toolCall;
  };

  const completedAgentProgress = Object.fromEntries(
    Object.entries(agentProgress).map(([parentToolCallId, toolCalls]) => [
      parentToolCallId,
      reachableToolCallIds.has(parentToolCallId)
        ? toolCalls.map(completeToolCall)
        : toolCalls,
    ]),
  );

  for (const approval of Object.values(pendingApprovals)) {
    if (reachableToolCallIds.has(approval.toolCallId)) {
      approvalIds.add(approval.approvalId);
    }
  }

  return {
    agentProgress: completedAgentProgress,
    approvalIds: [...approvalIds],
  };
}

/** Returns whether this session has a nested tool awaiting user approval. */
export function hasPendingSessionSubAgentApproval(
  messages: UIMessage[],
  agentProgress: Record<string, AgentToolCall[]>,
  pendingApprovals: Record<string, PendingSubAgentApproval>,
): boolean {
  const reachableToolCallIds = getReachableAgentToolCallIds(
    messages,
    agentProgress,
  );
  return Object.values(pendingApprovals).some((approval) =>
    reachableToolCallIds.has(approval.toolCallId),
  );
}

function getReachableAgentToolCallIds(
  messages: UIMessage[],
  agentProgress: Record<string, AgentToolCall[]>,
): Set<string> {
  const reachableToolCallIds = new Set<string>();

  for (const message of messages) {
    for (const part of message.parts ?? []) {
      const toolCallId = (part as {toolCallId?: unknown}).toolCallId;
      if (typeof toolCallId === 'string') {
        reachableToolCallIds.add(toolCallId);
      }
    }
  }

  return expandReachableAgentToolCallIds(reachableToolCallIds, agentProgress);
}

function expandReachableAgentToolCallIds(
  reachableToolCallIds: Set<string>,
  agentProgress: Record<string, AgentToolCall[]>,
): Set<string> {
  let foundReachableProgress = true;
  while (foundReachableProgress) {
    foundReachableProgress = false;
    for (const [parentToolCallId, toolCalls] of Object.entries(agentProgress)) {
      if (!reachableToolCallIds.has(parentToolCallId)) continue;
      for (const toolCall of toolCalls) {
        foundReachableProgress =
          addAgentToolCallIds(reachableToolCallIds, toolCall) ||
          foundReachableProgress;
      }
    }
  }

  return reachableToolCallIds;
}

function getAgentToolCallProgressSignal(toolCall: AgentToolCall): unknown[] {
  return [
    toolCall.toolCallId,
    toolCall.toolName,
    toolCall.state,
    toolCall.approvalId,
    toolCall.errorText,
    toolCall.startedAt,
    toolCall.completedAt,
    toolCall.agentToolCalls?.map(getAgentToolCallProgressSignal),
  ];
}

function addAgentToolCallIds(
  toolCallIds: Set<string>,
  toolCall: AgentToolCall,
): boolean {
  let foundNewToolCall = false;

  if (!toolCallIds.has(toolCall.toolCallId)) {
    toolCallIds.add(toolCall.toolCallId);
    foundNewToolCall = true;
  }

  for (const nestedCall of toolCall.agentToolCalls ?? []) {
    foundNewToolCall =
      addAgentToolCallIds(toolCallIds, nestedCall) || foundNewToolCall;
  }

  return foundNewToolCall;
}

function getLatestToolParts(
  messages: UIMessage[],
): Map<string, {toolName: string; state: string | undefined}> {
  const latestParts = new Map<
    string,
    {toolName: string; state: string | undefined}
  >();

  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const part of message.parts ?? []) {
      if (part.type !== 'dynamic-tool' && !part.type.startsWith('tool-')) {
        continue;
      }
      const typedPart = part as typeof part & {
        toolCallId?: string;
        toolName?: string;
        state?: string;
      };
      if (!typedPart.toolCallId) continue;
      latestParts.set(typedPart.toolCallId, {
        toolName:
          typedPart.type === 'dynamic-tool'
            ? typedPart.toolName || 'tool'
            : typedPart.type.replace(/^tool-/, '') || 'tool',
        state: typedPart.state,
      });
    }
  }

  return latestParts;
}

function formatTimeoutDuration(timeoutMs: number): string {
  if (timeoutMs % 60_000 === 0) return `${timeoutMs / 60_000}m`;
  if (timeoutMs % 1_000 === 0) return `${timeoutMs / 1_000}s`;
  return `${timeoutMs}ms`;
}
