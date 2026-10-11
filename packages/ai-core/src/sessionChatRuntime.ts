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

type SessionChatRuntimeState = {
  isRunning: boolean;
  abortController: AbortController | undefined;
  tools: StoredToolSet;
  remoteClientToolNames: readonly string[];
  timeouts: AiTimeoutOptions;
  agentProgress: Record<string, AgentToolCall[]>;
  pendingSubAgentApprovals: Record<string, PendingSubAgentApproval>;
};

type CreateSessionChatRuntimeOptions = {
  chat: Chat<UIMessage>;
  usesRemoteTransport: boolean;
  getState: () => SessionChatRuntimeState;
  subscribeToStateChanges: (onChange: () => void) => () => void;
  onMessagesChange: (messages: UIMessage[]) => void;
  onIdleTimeout: (messages: UIMessage[], error: Error) => void;
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
  subscribeToStateChanges,
  onMessagesChange,
  onIdleTimeout,
  onDeactivate,
}: CreateSessionChatRuntimeOptions) {
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
  let unsubscribeFromState = () => {};

  const clearIdleTimeout = () => {
    if (idleTimeoutId) clearTimeout(idleTimeoutId);
    idleTimeoutId = undefined;
  };

  const deactivate = () => {
    if (disposed) return false;
    disposed = true;
    unregisterMessages();
    unsubscribeFromState();
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
  unsubscribeFromState = subscribeToStateChanges(refresh);
  refresh();

  return {
    chat,
    dispose: () => {
      if (!deactivate()) return;
      void chat.stop();
    },
  };
}
