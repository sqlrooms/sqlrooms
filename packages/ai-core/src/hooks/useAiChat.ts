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

export type AddToolResult = (
  options:
    | {tool: string; toolCallId: string; output: unknown}
    | {
        tool: string;
        toolCallId: string;
        state: 'output-error';
        errorText: string;
      },
) => void;

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
    // Recreate transport when the model changes
    void model;
    const trimmed = (endPoint || '').trim();
    if (trimmed.length > 0) {
      return getRemoteChatTransport(trimmed, headers);
    }
    return getLocalChatTransport();
  }, [getLocalChatTransport, getRemoteChatTransport, headers, endPoint, model]);

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
  }, [sessionId, messagesRevision]);

  const {messages, sendMessage, addToolResult, stop, status} = useChat({
    id: `${sessionId}-${messagesRevision}`,
    transport,
    messages: initialMessages,
    onToolCall: async (opts) => {
      const {toolCall} = opts as {toolCall: unknown};
      // Wrap the store's onChatToolCall to provide addToolResult
      // Use the captured addToolResult from the ref
      return onChatToolCall?.({
        toolCall: toolCall as ToolCall,
        addToolResult: addToolResultRef.current,
      });
    },
    onFinish: onChatFinish,
    onError: onChatError,
    onData: onChatData,
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

  // Register stop with the store so cancelAnalysis can stop the stream
  useEffect(() => {
    setChatStop?.(stop);
    return () => setChatStop?.(undefined);
  }, [setChatStop, stop]);

  // Register sendMessage with the store so it can be accessed from the slice
  useEffect(() => {
    setChatSendMessage?.(sendMessage);
    return () => setChatSendMessage?.(undefined);
  }, [setChatSendMessage, sendMessage]);

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

  return {
    messages,
    sendMessage,
    stop,
    status,
  };
}
