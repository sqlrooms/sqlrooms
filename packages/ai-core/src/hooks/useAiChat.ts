import {useMemo, useEffect} from 'react';
import {useChat} from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import type {UIMessage} from 'ai';
import {useStoreWithAi} from '../AiSlice';
import {filterDataParts} from '../utils/messageFilter';

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
export function useAiChat() {
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
  // Store addToolResult in a variable that can be captured by the onToolCall closure
  let capturedAddToolResult: AddToolResult;

  const {messages, sendMessage, addToolResult} = useChat({
    id: `${sessionId}-${messagesRevision}`,
    transport,
    messages: (currentSession?.uiMessages as unknown as UIMessage[]) ?? [],
    onToolCall: async ({toolCall}: {toolCall: any}) => {
      // Wrap the store's onChatToolCall to provide addToolResult
      // Use the captured addToolResult from the outer scope
      return onChatToolCall?.({toolCall, addToolResult: capturedAddToolResult});
    },
    onFinish: onChatFinish,
    onError: onChatError,
    onData: onChatData,
    // Automatically submit when all tool results are available
    // NOTE: When using sendAutomaticallyWhen, don't use await with addToolResult inside onChatToolCall as it can cause deadlocks.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  // Capture addToolResult for use in onToolCall
  capturedAddToolResult = addToolResult;

  // Filter messages to remove data-tool-additional-output parts added during streaming
  const filteredMessages = useMemo(() => filterDataParts(messages), [messages]);

  // Sync streaming updates into the store so UiMessages renders incrementally
  useEffect(() => {
    if (!sessionId) return;
    setSessionUiMessages(sessionId, filteredMessages as UIMessage[]);
  }, [filteredMessages, sessionId, setSessionUiMessages]);

  return {
    messages: filteredMessages,
    sendMessage,
  };
}
