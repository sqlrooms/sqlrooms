import {useEffect, useMemo, useRef} from 'react';
import {useChat} from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import type {AbstractChat, ChatStatus, UIMessage} from 'ai';
import {useStoreWithAi} from '../AiSlice';
import type {ToolCall} from '../chatTransport';
import {completeIncompleteToolCalls} from '../chatTransport';
import type {AddToolResult} from '../types';

export type {AddToolResult} from '../types';

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
  const getLocalChatTransportForSession = useStoreWithAi(
    (s) => s.ai.getLocalChatTransportForSession,
  );
  const getRemoteChatTransport = useStoreWithAi(
    (s) => s.ai.getRemoteChatTransport,
  );
  const getRemoteChatTransportForSession = useStoreWithAi(
    (s) => s.ai.getRemoteChatTransportForSession,
  );
  const endPoint = useStoreWithAi((s) => s.ai.chatEndPoint);
  const headers = useStoreWithAi((s) => s.ai.chatHeaders);

  // Get chat handlers
  const onChatToolCallForSession = useStoreWithAi(
    (s) => s.ai.onChatToolCallForSession,
  );
  const onChatFinishForSession = useStoreWithAi(
    (s) => s.ai.onChatFinishForSession,
  );
  const onChatDataForSession = useStoreWithAi((s) => s.ai.onChatDataForSession);
  const onChatErrorForSession = useStoreWithAi(
    (s) => s.ai.onChatErrorForSession,
  );
  const setSessionUiMessages = useStoreWithAi((s) => s.ai.setSessionUiMessages);
  const setSessionChatStop = useStoreWithAi((s) => s.ai.setSessionChatStop);
  const setSessionChatSendMessage = useStoreWithAi(
    (s) => s.ai.setSessionChatSendMessage,
  );
  const setSessionAddToolResult = useStoreWithAi(
    (s) => s.ai.setSessionAddToolResult,
  );

  // Get per-session abort controller
  const getSessionAbortController = useStoreWithAi(
    (s) => s.ai.getSessionAbortController,
  );
  const abortController = getSessionAbortController(sessionId);
  const isAborted = abortController?.signal.aborted ?? false;
  const isAbortedRef = useRef<boolean>(isAborted);

  // Keep a live ref so sendAutomaticallyWhen sees latest abort state
  useEffect(() => {
    isAbortedRef.current = isAborted;
  }, [isAborted]);

  // Create transport (recreate when model changes)
  const transport: DefaultChatTransport<UIMessage> = useMemo(() => {
    void model;
    const trimmed = (endPoint || '').trim();
    if (trimmed.length > 0) {
      return getRemoteChatTransportForSession
        ? getRemoteChatTransportForSession(sessionId, trimmed, headers)
        : getRemoteChatTransport(trimmed, headers);
    }
    return getLocalChatTransportForSession
      ? getLocalChatTransportForSession(sessionId)
      : getLocalChatTransport();
  }, [
    getLocalChatTransport,
    getLocalChatTransportForSession,
    getRemoteChatTransport,
    getRemoteChatTransportForSession,
    headers,
    endPoint,
    model,
    sessionId,
  ]);

  // Store addToolResult in a ref that can be captured by the onToolCall closure
  const addToolResultRef = useRef<AddToolResult>(null!);

  // Gate auto-send when analysis is aborted or cancelled
  type SendAutoWhenArg = Parameters<
    typeof lastAssistantMessageIsCompleteWithToolCalls
  >[0];
  const shouldAutoSend = (options: SendAutoWhenArg) => {
    if (isAbortedRef.current) return false;
    return lastAssistantMessageIsCompleteWithToolCalls(options);
  };

  const initialMessages = useMemo(() => {
    return completeIncompleteToolCalls(
      (currentSession?.uiMessages as unknown as UIMessage[]) ?? [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally exclude uiMessages; only recompute on session change or explicit message deletion
  }, [sessionId, messagesRevision]);

  const {messages, sendMessage, addToolResult, stop, status} = useChat({
    // Encode sessionId into the request id so transports can resolve the owning session
    // even if the user switches sessions mid-stream.
    id: `${sessionId}::${messagesRevision}`,
    transport,
    messages: initialMessages,
    onToolCall: async (opts) => {
      const {toolCall} = opts as {toolCall: unknown};
      return onChatToolCallForSession?.(sessionId, {
        toolCall: toolCall as ToolCall,
        addToolResult: addToolResultRef.current,
      });
    },
    onFinish: ({messages}) => onChatFinishForSession?.(sessionId, {messages}),
    onError: (error) => onChatErrorForSession?.(sessionId, error),
    onData: (dataPart) => onChatDataForSession?.(sessionId, dataPart),
    sendAutomaticallyWhen: shouldAutoSend,
  });

  // Capture addToolResult for use in onToolCall
  addToolResultRef.current = addToolResult;

  // If user aborts mid-stream, stop the local chat stream immediately
  useEffect(() => {
    if (isAbortedRef.current && status === 'streaming') {
      stop();
    }
  }, [status, stop, isAborted]);

  // Register stop with the store for this specific session
  useEffect(() => {
    setSessionChatStop?.(sessionId, stop);
    return () => setSessionChatStop?.(sessionId, undefined);
  }, [setSessionChatStop, stop, sessionId]);

  // Register sendMessage with the store for this specific session
  useEffect(() => {
    setSessionChatSendMessage?.(sessionId, sendMessage);
    return () => setSessionChatSendMessage?.(sessionId, undefined);
  }, [setSessionChatSendMessage, sendMessage, sessionId]);

  // Register addToolResult with the store for this specific session
  useEffect(() => {
    setSessionAddToolResult?.(sessionId, addToolResult);
    return () => setSessionAddToolResult?.(sessionId, undefined);
  }, [setSessionAddToolResult, addToolResult, sessionId]);

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
