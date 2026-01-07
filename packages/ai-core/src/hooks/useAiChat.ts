import {useCallback, useEffect, useMemo, useRef} from 'react';
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
 * Return type for the useAiChat hook.
 */
export type UseAiChatResult = {
  messages: UIMessage[];
  sendMessage: AbstractChat<UIMessage>['sendMessage'];
  stop: AbstractChat<UIMessage>['stop'];
  status: ChatStatus;
};

/**
 * Custom hook that provides AI chat functionality with automatic transport setup,
 * message syncing, and tool call handling.
 *
 * This hook encapsulates all the logic needed to integrate the AI SDK's useChat
 * with the AI slice state management.
 *
 * @returns An object containing messages and sendMessage from useChat
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {messages, sendMessage} = useAiChat();
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
export function useAiChat(): UseAiChatResult {
  // Get current session and configuration
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const sessions = useStoreWithAi((s) => s.ai.config.sessions);
  const isRunningAnalysis = useStoreWithAi((s) => s.ai.isRunningAnalysis);
  const analysisRunSessionId = useStoreWithAi((s) => s.ai.analysisRunSessionId);

  // Pin the in-flight run to the session where it started (local to this hook).
  // This prevents session switching from re-keying useChat mid-stream and misrouting
  // streamed updates. We intentionally do NOT store this in global state.
  const runSessionIdRef = useRef<string | undefined>(undefined);
  const pinnedSessionId = analysisRunSessionId ?? runSessionIdRef.current;
  const pinnedSession =
    pinnedSessionId != null
      ? sessions.find((sess) => sess.id === pinnedSessionId)
      : undefined;

  const session = pinnedSession ?? currentSession;
  const sessionId = session?.id;
  const model = session?.model;
  // Use messagesRevision to force reset only when messages are explicitly deleted
  const messagesRevision = session?.messagesRevision ?? 0;

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

  // Abort/auto-send guards
  const isAborted = useStoreWithAi(
    (s) => s.ai.analysisAbortController?.signal.aborted ?? false,
  );
  const isAbortedRef = useRef<boolean>(isAborted);
  // Keep a live ref so sendAutomaticallyWhen sees latest abort state even if useChat doesn't reinit
  useEffect(() => {
    isAbortedRef.current = isAborted;
  }, [isAborted]);

  // Create transport (recreate when model changes)
  const transport: DefaultChatTransport<UIMessage> = useMemo(() => {
    void model;
    const trimmed = (endPoint || '').trim();
    if (trimmed.length > 0) {
      return getRemoteChatTransport(trimmed, headers, sessionId);
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

  // Setup useChat with all configuration
  // Include messagesRevision in the id to force reset only when messages are explicitly deleted
  // Store addToolResult in a ref that can be captured by the onToolCall closure
  const addToolResultRef = useRef<AddToolResult>(null!);

  // Gate auto-send when analysis is aborted or cancelled, to prevent unintended follow-ups
  type SendAutoWhenArg = Parameters<
    typeof lastAssistantMessageIsCompleteWithToolCalls
  >[0];
  const shouldAutoSend = (options: SendAutoWhenArg) => {
    if (isAbortedRef.current) return false;
    return lastAssistantMessageIsCompleteWithToolCalls(options);
  };

  const initialMessages = useMemo(() => {
    return completeIncompleteToolCalls(
      (session?.uiMessages as UIMessage[]) ?? [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally exclude uiMessages; only recompute on session change or explicit message deletion (messagesRevision)
  }, [sessionId, messagesRevision]);

  const {messages, sendMessage, addToolResult, stop, status} = useChat({
    id: `${sessionId}-${messagesRevision}`,
    transport,
    messages: initialMessages,
    onToolCall: async (opts) => {
      const {toolCall} = opts as {toolCall: unknown};
      // Wrap the store's onChatToolCall to provide addToolResult
      // Use the captured addToolResult from the ref
      const targetSessionId =
        analysisRunSessionId ?? runSessionIdRef.current ?? sessionId;
      if (!targetSessionId) return;
      return onChatToolCall?.({
        sessionId: targetSessionId,
        toolCall: toolCall as ToolCall,
        addToolResult: addToolResultRef.current,
      });
    },
    onFinish: (args) => {
      const targetSessionId =
        analysisRunSessionId ?? runSessionIdRef.current ?? sessionId;
      if (targetSessionId) {
        onChatFinish?.(targetSessionId, args);
      }
      // Clear local pin when the run ends
      runSessionIdRef.current = undefined;
    },
    onError: (error) => {
      const targetSessionId =
        analysisRunSessionId ?? runSessionIdRef.current ?? sessionId;
      if (targetSessionId) {
        onChatError?.(targetSessionId, error);
      }
      runSessionIdRef.current = undefined;
    },
    onData: (dataPart) => {
      const targetSessionId =
        analysisRunSessionId ?? runSessionIdRef.current ?? sessionId;
      if (targetSessionId) {
        onChatData?.(targetSessionId, dataPart);
      }
    },
    // Automatically submit when all tool results are available
    // NOTE: When using sendAutomaticallyWhen, don't use await with addToolResult inside onChatToolCall as it can cause deadlocks.
    sendAutomaticallyWhen: shouldAutoSend,
  });

  const wrappedSendMessage = useCallback<typeof sendMessage>(
    (message, opts) => {
      if (!runSessionIdRef.current && sessionId) {
        runSessionIdRef.current = sessionId;
      }
      return sendMessage(message, opts);
    },
    [sendMessage, sessionId],
  );

  // Capture addToolResult for use in onToolCall
  addToolResultRef.current = addToolResult;

  // If user aborts mid-stream, stop the local chat stream immediately
  useEffect(() => {
    if (isAbortedRef.current && status === 'streaming') {
      stop();
    }
  }, [status, stop, isAborted]);

  // Register stop with the store so cancelAnalysis can stop the stream
  useEffect(() => {
    setChatStop?.(stop);
    return () => setChatStop?.(undefined);
  }, [setChatStop, stop]);

  // Register sendMessage with the store so it can be accessed from the slice
  useEffect(() => {
    setChatSendMessage?.(wrappedSendMessage);
    return () => setChatSendMessage?.(undefined);
  }, [setChatSendMessage, wrappedSendMessage]);

  // Register addToolResult with the store so it can be accessed from the slice
  useEffect(() => {
    setAddToolResult?.(addToolResult);
    return () => setAddToolResult?.(undefined);
  }, [setAddToolResult, addToolResult]);

  // Sync streaming updates into the store so UiMessages renders incrementally
  useEffect(() => {
    if (!sessionId) return;
    setSessionUiMessages(sessionId, messages as UIMessage[]);
  }, [messages, sessionId, setSessionUiMessages]);

  // Ensure we clear any stale local pin when analysis is no longer running
  useEffect(() => {
    if (!isRunningAnalysis) {
      runSessionIdRef.current = undefined;
    }
  }, [isRunningAnalysis]);

  return {
    messages,
    sendMessage: wrappedSendMessage,
    stop,
    status,
  };
}
