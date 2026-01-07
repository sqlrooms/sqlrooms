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
  const sessionId = currentSession?.id;
  const model = currentSession?.model;
  // Use messagesRevision to force reset only when messages are explicitly deleted
  const messagesRevision = currentSession?.messagesRevision ?? 0;

  // Get chat transport configuration - these now require sessionId
  const getLocalChatTransport = useStoreWithAi(
    (s) => s.ai.getLocalChatTransport,
  );
  const getRemoteChatTransport = useStoreWithAi(
    (s) => s.ai.getRemoteChatTransport,
  );
  const endPoint = useStoreWithAi((s) => s.ai.chatEndPoint);
  const headers = useStoreWithAi((s) => s.ai.chatHeaders);

  // Get function to create session-specific handlers
  const createChatHandlersForSession = useStoreWithAi(
    (s) => s.ai.createChatHandlersForSession,
  );

  const setSessionUiMessages = useStoreWithAi((s) => s.ai.setSessionUiMessages);
  const setChatStop = useStoreWithAi((s) => s.ai.setChatStop);
  const setChatSendMessage = useStoreWithAi((s) => s.ai.setChatSendMessage);
  const setAddToolResult = useStoreWithAi((s) => s.ai.setAddToolResult);

  // Get per-session abort signal
  const getSessionAbortSignal = useStoreWithAi(
    (s) => s.ai.getSessionAbortSignal,
  );

  // Abort/auto-send guards - use per-session abort signal
  const isAborted = sessionId
    ? (getSessionAbortSignal(sessionId)?.aborted ?? false)
    : false;
  const isAbortedRef = useRef<boolean>(isAborted);
  // Keep a live ref so sendAutomaticallyWhen sees latest abort state even if useChat doesn't reinit
  useEffect(() => {
    isAbortedRef.current = isAborted;
  }, [isAborted]);

  // Capture sessionId for use in closures - this is the key fix for the bug
  const capturedSessionId = sessionId;

  // Create session-specific handlers (recreate when session changes)
  const sessionHandlers = useMemo(() => {
    if (!capturedSessionId) return null;
    return createChatHandlersForSession(capturedSessionId);
  }, [capturedSessionId, createChatHandlersForSession]);

  // Create transport (recreate when model or session changes)
  const transport: DefaultChatTransport<UIMessage> | null = useMemo(() => {
    if (!capturedSessionId) return null;
    // Recreate transport when the model changes
    void model;
    const trimmed = (endPoint || '').trim();
    if (trimmed.length > 0) {
      return getRemoteChatTransport(capturedSessionId, trimmed, headers);
    }
    return getLocalChatTransport(capturedSessionId);
  }, [
    getLocalChatTransport,
    getRemoteChatTransport,
    headers,
    endPoint,
    model,
    capturedSessionId,
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
      (currentSession?.uiMessages as unknown as UIMessage[]) ?? [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally exclude uiMessages; only recompute on session change or explicit message deletion (messagesRevision)
  }, [sessionId, messagesRevision]);

  const {messages, sendMessage, addToolResult, stop, status} = useChat({
    id: `${sessionId}-${messagesRevision}`,
    transport: transport!,
    messages: initialMessages,
    onToolCall: async (opts) => {
      const {toolCall} = opts as {toolCall: unknown};
      // Use session-specific handler
      return sessionHandlers?.onChatToolCall?.({
        toolCall: toolCall as ToolCall,
        addToolResult: addToolResultRef.current,
      });
    },
    onFinish: sessionHandlers?.onChatFinish,
    onError: sessionHandlers?.onChatError,
    onData: sessionHandlers?.onChatData,
    // Automatically submit when all tool results are available
    // NOTE: When using sendAutomaticallyWhen, don't use await with addToolResult inside onChatToolCall as it can cause deadlocks.
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

  // Register stop with the store keyed by sessionId so cancelSession can stop the stream
  useEffect(() => {
    if (!capturedSessionId) return;
    setChatStop?.(capturedSessionId, stop);
    return () => setChatStop?.(capturedSessionId, undefined);
  }, [setChatStop, stop, capturedSessionId]);

  // Register sendMessage with the store keyed by sessionId
  useEffect(() => {
    if (!capturedSessionId) return;
    setChatSendMessage?.(capturedSessionId, sendMessage);
    return () => setChatSendMessage?.(capturedSessionId, undefined);
  }, [setChatSendMessage, sendMessage, capturedSessionId]);

  // Register addToolResult with the store keyed by sessionId
  useEffect(() => {
    if (!capturedSessionId) return;
    setAddToolResult?.(capturedSessionId, addToolResult);
    return () => setAddToolResult?.(capturedSessionId, undefined);
  }, [setAddToolResult, addToolResult, capturedSessionId]);

  // Sync streaming updates into the store so UiMessages renders incrementally
  // Use capturedSessionId to ensure messages go to the correct session
  useEffect(() => {
    if (!capturedSessionId) return;
    setSessionUiMessages(capturedSessionId, messages as UIMessage[]);
  }, [messages, capturedSessionId, setSessionUiMessages]);

  return {
    messages,
    sendMessage,
    stop,
    status,
  };
}
