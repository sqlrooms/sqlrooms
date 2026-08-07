import {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {useChat} from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import type {AbstractChat, ChatStatus, UIMessage} from 'ai';
import {useStoreWithAi} from '../AiSlice';
import {fixIncompleteToolCalls} from '../utils';
import {hasPendingToolApproval} from '../components/ChatActiveStatus';
import {
  createIdleStreamTimeoutError,
  createToolTimeoutError,
  getConfiguredTimeoutMs,
  getPendingClientToolCalls,
  getPendingClientToolTimeouts,
  getSessionAgentProgressSignal,
  hasPendingCurrentTurnExecutableToolCall,
  hasPendingSessionSubAgentApproval,
} from '../timeouts';

export type {AddToolOutput} from '../types';

/**
 * Return type for the useSessionChat hook.
 */
export type UseSessionChatResult = {
  messages: UIMessage[];
  sendMessage: AbstractChat<UIMessage>['sendMessage'];
  stop: AbstractChat<UIMessage>['stop'];
  status: ChatStatus;
  sessionId: string;
};

/**
 * Custom hook that provides per-session AI chat functionality.
 * Each session gets its own independent useChat instance.
 *
 * @param sessionId - The ID of the session to manage chat for
 * @returns An object containing messages, sendMessage, stop, and status for this session
 *
 * @example
 * ```tsx
 * function SessionComponent({ sessionId }) {
 *   const {messages, sendMessage, stop, status} = useSessionChat(sessionId);
 *
 *   const handleSubmit = () => {
 *     sendMessage({text: 'Hello!'});
 *   };
 *
 *   return (
 *     <div>
 *       {messages.map(msg => <div key={msg.id}>{msg.content}</div>)}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSessionChat(sessionId: string): UseSessionChatResult {
  // Get the specific session - use a targeted selector to avoid unnecessary re-renders
  // when other sessions change
  const currentSession = useStoreWithAi((s) =>
    s.ai.config.sessions.find((session) => session.id === sessionId),
  );
  const model = currentSession?.model;
  const messagesRevision = currentSession?.messagesRevision ?? 0;

  // Get chat transport configuration
  const getLocalChatTransport = useStoreWithAi(
    (s) => s.ai.getLocalChatTransport,
  );
  const getRemoteChatTransport = useStoreWithAi(
    (s) => s.ai.getRemoteChatTransport,
  );
  const endPoint = useStoreWithAi((s) => s.ai.chatEndPoint);
  const headers = useStoreWithAi((s) => s.ai.chatHeaders);
  const usesRemoteTransport = (endPoint || '').trim().length > 0;

  // Get chat handlers
  const onChatFinish = useStoreWithAi((s) => s.ai.onChatFinish);
  const onChatError = useStoreWithAi((s) => s.ai.onChatError);
  const setSessionUiMessages = useStoreWithAi((s) => s.ai.setSessionUiMessages);
  const setChatStop = useStoreWithAi((s) => s.ai.setChatStop);
  const setChatSendMessage = useStoreWithAi((s) => s.ai.setChatSendMessage);
  const setAddToolOutput = useStoreWithAi((s) => s.ai.setAddToolOutput);
  const setAddToolApprovalResponse = useStoreWithAi(
    (s) => s.ai.setAddToolApprovalResponse,
  );
  const persistTimedOutSession = useStoreWithAi(
    (s) => s.ai.persistTimedOutSession,
  );
  const tools = useStoreWithAi((s) => s.ai.tools);
  const remoteClientToolNames = useStoreWithAi(
    (s) => s.ai.remoteClientToolNames,
  );
  const timeouts = useStoreWithAi((s) => s.ai.timeouts);
  const agentProgress = useStoreWithAi((s) => s.ai.agentProgress);
  const pendingSubAgentApprovals = useStoreWithAi(
    (s) => s.ai.pendingSubAgentApprovals,
  );

  // Get per-session abort controller
  const getAbortController = useStoreWithAi((s) => s.ai.getAbortController);
  const abortController = getAbortController(sessionId);
  const isAborted = abortController?.signal.aborted ?? false;
  const isAbortedRef = useRef<boolean>(isAborted);

  // Keep a live ref so abort checks see the latest state
  useEffect(() => {
    isAbortedRef.current = isAborted;
  }, [isAborted]);

  // Create transport (recreate when model changes)
  const transport: DefaultChatTransport<UIMessage> = useMemo(() => {
    void model;
    const trimmed = (endPoint || '').trim();
    if (trimmed.length > 0) {
      return getRemoteChatTransport(sessionId, trimmed, headers);
    }
    return getLocalChatTransport(sessionId);
  }, [
    getLocalChatTransport,
    getRemoteChatTransport,
    headers,
    endPoint,
    model,
    sessionId,
  ]);

  const initialMessages = useMemo(() => {
    return fixIncompleteToolCalls(
      (currentSession?.uiMessages ?? []) as UIMessage[],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally exclude uiMessages; only recompute on session change or explicit message deletion
  }, [sessionId, messagesRevision]);
  const latestMessagesRef = useRef<UIMessage[]>(initialMessages);
  const clientToolTimeoutsRef = useRef(
    new Map<
      string,
      {timeoutId: ReturnType<typeof setTimeout>; timeoutMs: number}
    >(),
  );

  const {
    messages,
    sendMessage,
    addToolOutput,
    addToolApprovalResponse,
    stop,
    status,
  } = useChat({
    // Unique per-session/per-revision id so each session has an independent chat stream,
    // and we can force a reset when messagesRevision changes.
    id: `${sessionId}::${messagesRevision}`,
    transport,
    messages: initialMessages,
    // Auto-resend after all client-side tool outputs or approval responses are provided,
    // but skip if the session was aborted.
    sendAutomaticallyWhen: (
      options: Parameters<
        typeof lastAssistantMessageIsCompleteWithApprovalResponses
      >[0],
    ) => {
      if (isAbortedRef.current) return false;
      return (
        lastAssistantMessageIsCompleteWithToolCalls(options) ||
        lastAssistantMessageIsCompleteWithApprovalResponses(options)
      );
    },
    onFinish: ({messages}) => onChatFinish?.({sessionId, messages}),
    onError: (error) =>
      onChatError?.(sessionId, error, latestMessagesRef.current),
  });
  const sessionAgentProgressSignal = useMemo(
    () => getSessionAgentProgressSignal(messages as UIMessage[], agentProgress),
    [agentProgress, messages],
  );
  const isWaitingForSubAgentApproval = useMemo(
    () =>
      hasPendingSessionSubAgentApproval(
        messages as UIMessage[],
        agentProgress,
        pendingSubAgentApprovals,
      ),
    [agentProgress, messages, pendingSubAgentApprovals],
  );

  // Fail tools that never provide expected client-side output. Local executable
  // tools are timed out in the local agent transport instead.
  useEffect(() => {
    const pending = currentSession?.isRunning
      ? getPendingClientToolTimeouts(messages as UIMessage[], tools, timeouts, {
          executableClientToolNames: usesRemoteTransport
            ? remoteClientToolNames
            : undefined,
        })
      : [];
    const pendingIds = new Set(pending.map(({toolCallId}) => toolCallId));

    for (const [toolCallId, entry] of clientToolTimeoutsRef.current) {
      if (!pendingIds.has(toolCallId)) {
        clearTimeout(entry.timeoutId);
        clientToolTimeoutsRef.current.delete(toolCallId);
      }
    }

    for (const {toolCallId, toolName, timeoutMs} of pending) {
      const existing = clientToolTimeoutsRef.current.get(toolCallId);
      if (existing?.timeoutMs === timeoutMs) continue;
      if (existing) clearTimeout(existing.timeoutId);

      const timeoutId = setTimeout(() => {
        clientToolTimeoutsRef.current.delete(toolCallId);
        addToolOutput({
          tool: toolName,
          toolCallId,
          state: 'output-error',
          errorText: createToolTimeoutError(toolName, timeoutMs).message,
        });
      }, timeoutMs);
      clientToolTimeoutsRef.current.set(toolCallId, {timeoutId, timeoutMs});
    }
  }, [
    addToolOutput,
    currentSession?.isRunning,
    messages,
    remoteClientToolNames,
    timeouts,
    tools,
    usesRemoteTransport,
  ]);

  useEffect(
    () => () => {
      for (const {timeoutId} of clientToolTimeoutsRef.current.values()) {
        clearTimeout(timeoutId);
      }
      clientToolTimeoutsRef.current.clear();
    },
    [],
  );

  // Treat UI message updates as observable stream progress. This cannot tell
  // a silent-but-healthy operation from a stuck one, so the watchdog is opt-in.
  useEffect(() => {
    // Re-arm the watchdog whenever a nested agent reports observable progress.
    void sessionAgentProgressSignal;
    const timeoutMs = getConfiguredTimeoutMs(timeouts.idleStreamMs);
    const uiMessages = messages as UIMessage[];
    const isWaitingForApproval = hasPendingToolApproval(uiMessages);
    const isWaitingForClientTool =
      getPendingClientToolCalls(uiMessages, tools, {
        executableClientToolNames: usesRemoteTransport
          ? remoteClientToolNames
          : undefined,
      }).length > 0;
    const isRunningLocalTool =
      !usesRemoteTransport &&
      hasPendingCurrentTurnExecutableToolCall(uiMessages, tools);
    if (
      !currentSession?.isRunning ||
      timeoutMs == null ||
      isWaitingForApproval ||
      isWaitingForSubAgentApproval ||
      isWaitingForClientTool ||
      isRunningLocalTool
    ) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const controller = getAbortController(sessionId);
      if (!controller || controller.signal.aborted) return;
      const timeoutError = createIdleStreamTimeoutError(timeoutMs);
      controller.abort(timeoutError);
      persistTimedOutSession(
        sessionId,
        latestMessagesRef.current,
        timeoutError.message,
      );
      stop();
    }, timeoutMs);
    return () => clearTimeout(timeoutId);
  }, [
    currentSession?.isRunning,
    getAbortController,
    isWaitingForSubAgentApproval,
    messages,
    persistTimedOutSession,
    remoteClientToolNames,
    sessionAgentProgressSignal,
    sessionId,
    stop,
    timeouts.idleStreamMs,
    tools,
    usesRemoteTransport,
  ]);

  // If user aborts mid-stream, stop the local chat stream immediately
  useEffect(() => {
    if (isAbortedRef.current && status === 'streaming') {
      stop();
    }
  }, [status, stop, isAborted]);

  // Register stop with the store for this specific session
  useEffect(() => {
    setChatStop?.(sessionId, stop);
    return () => setChatStop?.(sessionId, undefined);
  }, [setChatStop, stop, sessionId]);

  // Register sendMessage with the store for this specific session
  useEffect(() => {
    setChatSendMessage?.(sessionId, sendMessage);
    return () => setChatSendMessage?.(sessionId, undefined);
  }, [setChatSendMessage, sendMessage, sessionId]);

  // Register addToolOutput with the store for this specific session
  useEffect(() => {
    setAddToolOutput?.(sessionId, addToolOutput);
    return () => setAddToolOutput?.(sessionId, undefined);
  }, [setAddToolOutput, addToolOutput, sessionId]);

  // Register addToolApprovalResponse with the store for this specific session
  useEffect(() => {
    setAddToolApprovalResponse?.(sessionId, addToolApprovalResponse);
    return () => setAddToolApprovalResponse?.(sessionId, undefined);
  }, [setAddToolApprovalResponse, addToolApprovalResponse, sessionId]);

  // Keep the error fallback current before the passive store sync can race with
  // an immediately rejected transport request.
  useLayoutEffect(() => {
    latestMessagesRef.current = messages as UIMessage[];
  }, [messages]);

  // Sync streaming updates into the store so UiMessages renders incrementally
  useEffect(() => {
    if (!sessionId) return;
    setSessionUiMessages(sessionId, messages as UIMessage[]);
  }, [messages, sessionId, setSessionUiMessages]);

  return {
    messages,
    sendMessage,
    stop,
    status,
    sessionId,
  };
}
