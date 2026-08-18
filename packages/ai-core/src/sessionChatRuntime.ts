import {Chat} from '@ai-sdk/react';
import type {UIMessage} from 'ai';
import type {
  AgentToolCall,
  PendingSubAgentApproval,
  StoredToolSet,
} from './types';
import {
  createIdleStreamTimeoutError,
  createToolTimeoutError,
  getConfiguredTimeoutMs,
  getPendingClientToolCalls,
  getPendingClientToolTimeouts,
  getSessionAgentProgressSignal,
  hasPendingCurrentTurnExecutableToolCall,
  hasPendingSessionSubAgentApproval,
  hasPendingToolApproval,
  type AiTimeoutOptions,
} from './timeouts';

/** Runtime state read by a session chat without becoming part of its interface. */
export type SessionChatRuntimeState = {
  isRunning: boolean;
  abortController: AbortController | undefined;
  tools: StoredToolSet;
  remoteClientToolNames: readonly string[];
  timeouts: AiTimeoutOptions;
  agentProgress: Record<string, AgentToolCall[]>;
  pendingSubAgentApprovals: Record<string, PendingSubAgentApproval>;
};

/**
 * Ephemeral per-session chat runtime. Persisted session state remains owned by
 * the AI slice; this module owns the live SDK chat and its lifecycle resources.
 */
export type SessionChatController = {
  chat: Chat<UIMessage>;
  /** Re-evaluates timeout scheduling after non-message runtime state changes. */
  refresh: () => void;
  /** Stops the chat and releases subscriptions and timers. */
  dispose: () => void;
};

/** Options for constructing one ephemeral session chat runtime. */
export type CreateSessionChatRuntimeOptions = {
  chat: Chat<UIMessage>;
  usesRemoteTransport: boolean;
  getState: () => SessionChatRuntimeState;
  onMessagesChange: (messages: UIMessage[]) => void;
  onIdleTimeout: (messages: UIMessage[], error: Error) => void;
  /** Fences callbacks before a terminal runtime-owned shutdown. */
  onDeactivate?: () => void;
};

/**
 * Creates a deep runtime module around an AI SDK chat. The runtime synchronizes
 * streaming messages and owns client-tool and idle-watchdog timers.
 */
export function createSessionChatRuntime({
  chat,
  usesRemoteTransport,
  getState,
  onMessagesChange,
  onIdleTimeout,
  onDeactivate,
}: CreateSessionChatRuntimeOptions): SessionChatController {
  const clientToolTimeouts = new Map<
    string,
    {timeoutId: ReturnType<typeof setTimeout>; timeoutMs: number}
  >();
  let idleTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let lastMessages = chat.messages;
  let lastAgentProgressSignal = '';
  let lastIdleDisposition = '';
  let unregisterMessages = () => {};

  const clearIdleTimeout = () => {
    if (idleTimeoutId) clearTimeout(idleTimeoutId);
    idleTimeoutId = undefined;
  };

  const deactivate = () => {
    if (disposed) return false;
    disposed = true;
    unregisterMessages();
    clearIdleTimeout();
    for (const {timeoutId} of clientToolTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    clientToolTimeouts.clear();
    onDeactivate?.();
    return true;
  };

  const syncClientToolTimeouts = (
    messages: UIMessage[],
    state: SessionChatRuntimeState,
  ) => {
    const pending = state.isRunning
      ? getPendingClientToolTimeouts(messages, state.tools, state.timeouts, {
          executableClientToolNames: usesRemoteTransport
            ? state.remoteClientToolNames
            : undefined,
        })
      : [];
    const pendingIds = new Set(pending.map(({toolCallId}) => toolCallId));

    for (const [toolCallId, entry] of clientToolTimeouts) {
      if (!pendingIds.has(toolCallId)) {
        clearTimeout(entry.timeoutId);
        clientToolTimeouts.delete(toolCallId);
      }
    }

    for (const {toolCallId, toolName, timeoutMs} of pending) {
      const existing = clientToolTimeouts.get(toolCallId);
      if (existing?.timeoutMs === timeoutMs) continue;
      if (existing) clearTimeout(existing.timeoutId);

      const timeoutId = setTimeout(() => {
        clientToolTimeouts.delete(toolCallId);
        void chat.addToolOutput({
          tool: toolName,
          toolCallId,
          state: 'output-error',
          errorText: createToolTimeoutError(toolName, timeoutMs).message,
        });
      }, timeoutMs);
      clientToolTimeouts.set(toolCallId, {timeoutId, timeoutMs});
    }
  };

  const syncIdleWatchdog = (
    messages: UIMessage[],
    state: SessionChatRuntimeState,
  ) => {
    const timeoutMs = getConfiguredTimeoutMs(state.timeouts.idleStreamMs);
    const agentProgressSignal = getSessionAgentProgressSignal(
      messages,
      state.agentProgress,
    );
    const isWaitingForApproval = hasPendingToolApproval(messages);
    const isWaitingForSubAgentApproval = hasPendingSessionSubAgentApproval(
      messages,
      state.agentProgress,
      state.pendingSubAgentApprovals,
    );
    const isWaitingForClientTool =
      getPendingClientToolCalls(messages, state.tools, {
        executableClientToolNames: usesRemoteTransport
          ? state.remoteClientToolNames
          : undefined,
      }).length > 0;
    const isRunningLocalTool =
      !usesRemoteTransport &&
      hasPendingCurrentTurnExecutableToolCall(messages, state.tools);
    const shouldWatch =
      state.isRunning &&
      timeoutMs != null &&
      !isWaitingForApproval &&
      !isWaitingForSubAgentApproval &&
      !isWaitingForClientTool &&
      !isRunningLocalTool;
    const idleDisposition = JSON.stringify([
      shouldWatch,
      timeoutMs,
      isWaitingForApproval,
      isWaitingForSubAgentApproval,
      isWaitingForClientTool,
      isRunningLocalTool,
    ]);
    const shouldReschedule =
      messages !== lastMessages ||
      agentProgressSignal !== lastAgentProgressSignal ||
      idleDisposition !== lastIdleDisposition;

    lastMessages = messages;
    lastAgentProgressSignal = agentProgressSignal;
    lastIdleDisposition = idleDisposition;

    if (!shouldWatch) {
      clearIdleTimeout();
      return;
    }
    if (!shouldReschedule && idleTimeoutId) return;

    clearIdleTimeout();
    idleTimeoutId = setTimeout(() => {
      idleTimeoutId = undefined;
      const currentState = getState();
      const controller = currentState.abortController;
      if (!controller || controller.signal.aborted) return;

      const timeoutError = createIdleStreamTimeoutError(timeoutMs);
      controller.abort(timeoutError);
      deactivate();
      onIdleTimeout(chat.messages, timeoutError);
      void chat.stop();
    }, timeoutMs);
  };

  const refresh = () => {
    if (disposed) return;
    const messages = chat.messages;
    const state = getState();
    syncClientToolTimeouts(messages, state);
    syncIdleWatchdog(messages, state);
  };

  unregisterMessages = chat['~registerMessagesCallback'](() => {
    if (disposed) return;
    onMessagesChange(chat.messages);
    refresh();
  });
  refresh();

  return {
    chat,
    refresh,
    dispose: () => {
      if (!deactivate()) return;
      void chat.stop();
    },
  };
}

/** Lifecycle fence supplied to a runtime by its registry entry. */
export type SessionChatControllerLifecycle = {
  /** True while this runtime is the current generation for its session. */
  isCurrent: () => boolean;
  /** Releases this generation without recursively disposing it. */
  release: () => void;
};

/** Registry interface for versioned per-session chat runtimes. */
export type SessionChatControllerRegistry = {
  ensure: (
    sessionId: string,
    version: string,
    create: (
      lifecycle: SessionChatControllerLifecycle,
    ) => SessionChatController,
  ) => SessionChatController;
  get: (sessionId: string) => SessionChatController | undefined;
  refresh: (sessionId: string) => void;
  refreshAll: () => void;
  delete: (sessionId: string) => void;
  clear: () => void;
};

/** Creates a registry that replaces and disposes stale session runtimes. */
export function createSessionChatRuntimeRegistry(): SessionChatControllerRegistry {
  const runtimes = new Map<
    string,
    {version: string; token: object; runtime: SessionChatController}
  >();

  return {
    ensure: (sessionId, version, create) => {
      const existing = runtimes.get(sessionId);
      if (existing?.version === version) return existing.runtime;
      runtimes.delete(sessionId);
      existing?.runtime.dispose();
      const token = {};
      const isCurrent = () => runtimes.get(sessionId)?.token === token;
      const runtime = create({
        isCurrent,
        release: () => {
          if (isCurrent()) runtimes.delete(sessionId);
        },
      });
      runtimes.set(sessionId, {version, token, runtime});
      return runtime;
    },
    get: (sessionId) => runtimes.get(sessionId)?.runtime,
    refresh: (sessionId) => runtimes.get(sessionId)?.runtime.refresh(),
    refreshAll: () => {
      for (const {runtime} of runtimes.values()) runtime.refresh();
    },
    delete: (sessionId) => {
      const runtime = runtimes.get(sessionId)?.runtime;
      runtimes.delete(sessionId);
      runtime?.dispose();
    },
    clear: () => {
      const activeRuntimes = [...runtimes.values()];
      runtimes.clear();
      for (const {runtime} of activeRuntimes) runtime.dispose();
    },
  };
}
