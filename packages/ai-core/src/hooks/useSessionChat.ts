import {useEffect, useMemo, useRef} from 'react';
import {useChat} from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import type {AbstractChat, ChatStatus, UIMessage} from 'ai';
import {useStoreWithAi} from '../AiSlice';
import type {ToolCall} from '../chatTransport';
import {fixIncompleteToolCalls} from '../utils';
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

type SendAutoWhenArg = Parameters<
  typeof lastAssistantMessageIsCompleteWithToolCalls
>[0];

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

  // Get chat handlers
  const onChatToolCall = useStoreWithAi((s) => s.ai.onChatToolCall);
  const onChatFinish = useStoreWithAi((s) => s.ai.onChatFinish);
  const onChatData = useStoreWithAi((s) => s.ai.onChatData);
  const onChatError = useStoreWithAi((s) => s.ai.onChatError);
  const setSessionUiMessages = useStoreWithAi((s) => s.ai.setSessionUiMessages);
  const setChatStop = useStoreWithAi((s) => s.ai.setChatStop);
  const setChatSendMessage = useStoreWithAi((s) => s.ai.setChatSendMessage);
  const setAddToolResult = useStoreWithAi((s) => s.ai.setAddToolResult);

  // Get per-session abort controller
  const getAbortController = useStoreWithAi((s) => s.ai.getAbortController);
  const abortController = getAbortController(sessionId);
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

  // Store addToolResult in a ref that can be captured by the onToolCall closure
  const addToolResultRef = useRef<AddToolResult>(null!);

  // Gate auto-send when analysis is aborted or cancelled
  const shouldAutoSend = (options: SendAutoWhenArg) => {
    if (isAbortedRef.current) return false;
    return lastAssistantMessageIsCompleteWithToolCalls(options);
  };

  const initialMessages = useMemo(() => {
    return fixIncompleteToolCalls(
      (currentSession?.uiMessages as unknown as UIMessage[]) ?? [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally exclude uiMessages; only recompute on session change or explicit message deletion
  }, [sessionId, messagesRevision]);

  const {messages, sendMessage, addToolResult, stop, status} = useChat({
    // Unique per-session/per-revision id so each session has an independent chat stream,
    // and we can force a reset when messagesRevision changes.
    id: `${sessionId}::${messagesRevision}`,
    transport,
    messages: initialMessages,
    onToolCall: async (opts) => {
      const {toolCall} = opts as {toolCall: unknown};
      return onChatToolCall?.({
        sessionId,
        toolCall: toolCall as ToolCall,
        addToolResult: addToolResultRef.current,
      });
    },
    onFinish: ({messages}) => onChatFinish?.({sessionId, messages}),
    onError: (error) => onChatError?.(sessionId, error),
    onData: (dataPart) => onChatData?.(sessionId, dataPart),
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
    setChatStop?.(sessionId, stop);
    return () => setChatStop?.(sessionId, undefined);
  }, [setChatStop, stop, sessionId]);

  // Register sendMessage with the store for this specific session
  useEffect(() => {
    setChatSendMessage?.(sessionId, sendMessage);
    return () => setChatSendMessage?.(sessionId, undefined);
  }, [setChatSendMessage, sendMessage, sessionId]);

  // Register addToolResult with the store for this specific session
  useEffect(() => {
    setAddToolResult?.(sessionId, addToolResult);
    return () => setAddToolResult?.(sessionId, undefined);
  }, [setAddToolResult, addToolResult, sessionId]);

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
