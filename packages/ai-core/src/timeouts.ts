import type {UIMessage} from 'ai';
import type {StoredToolSet} from './types';

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

/** Finds no-execute tools that are waiting for client-side output. */
export function getPendingClientToolCalls(
  messages: UIMessage[],
  tools: StoredToolSet,
): PendingClientToolCall[] {
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

  const pending: PendingClientToolCall[] = [];
  for (const [toolCallId, part] of latestParts) {
    if (part.state !== 'input-available' || tools[part.toolName]?.execute) {
      continue;
    }
    pending.push({toolCallId, toolName: part.toolName});
  }
  return pending;
}

/** Finds pending client tools whose opt-in execution timeout is enabled. */
export function getPendingClientToolTimeouts(
  messages: UIMessage[],
  tools: StoredToolSet,
  options: AiTimeoutOptions | undefined,
): PendingClientToolTimeout[] {
  return getPendingClientToolCalls(messages, tools).flatMap((pending) => {
    const timeoutMs = getToolExecutionTimeoutMs(options, pending.toolName);
    return timeoutMs == null ? [] : [{...pending, timeoutMs}];
  });
}

function formatTimeoutDuration(timeoutMs: number): string {
  if (timeoutMs % 60_000 === 0) return `${timeoutMs / 60_000}m`;
  if (timeoutMs % 1_000 === 0) return `${timeoutMs / 1_000}s`;
  return `${timeoutMs}ms`;
}
