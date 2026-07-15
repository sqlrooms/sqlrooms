import type {UIMessage} from 'ai';
import type {StoredToolSet} from './types';

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

export function getConfiguredTimeoutMs(
  timeoutMs: number | undefined,
): number | undefined {
  return typeof timeoutMs === 'number' &&
    Number.isFinite(timeoutMs) &&
    timeoutMs > 0
    ? timeoutMs
    : undefined;
}

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

export function createRunTimeoutError(timeoutMs: number): ChatTimeoutError {
  return new ChatTimeoutError(
    'run',
    timeoutMs,
    `Chat run timed out after ${formatTimeoutDuration(timeoutMs)}`,
  );
}

export function createIdleStreamTimeoutError(
  timeoutMs: number,
): ChatTimeoutError {
  return new ChatTimeoutError(
    'idle-stream',
    timeoutMs,
    `No model or tool progress received for ${formatTimeoutDuration(timeoutMs)}`,
  );
}

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

export type PendingClientToolTimeout = {
  toolName: string;
  toolCallId: string;
  timeoutMs: number;
};

/** Finds no-execute tools that are waiting for client-side output. */
export function getPendingClientToolTimeouts(
  messages: UIMessage[],
  tools: StoredToolSet,
  options: AiTimeoutOptions | undefined,
): PendingClientToolTimeout[] {
  const latestParts = new Map<
    string,
    {toolName: string; state: string | undefined}
  >();

  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const part of message.parts) {
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

  const pending: PendingClientToolTimeout[] = [];
  for (const [toolCallId, part] of latestParts) {
    if (part.state !== 'input-available' || tools[part.toolName]?.execute) {
      continue;
    }
    const timeoutMs = getToolExecutionTimeoutMs(options, part.toolName);
    if (timeoutMs != null) {
      pending.push({toolCallId, toolName: part.toolName, timeoutMs});
    }
  }
  return pending;
}

function formatTimeoutDuration(timeoutMs: number): string {
  if (timeoutMs % 60_000 === 0) return `${timeoutMs / 60_000}m`;
  if (timeoutMs % 1_000 === 0) return `${timeoutMs / 1_000}s`;
  return `${timeoutMs}ms`;
}
