import {useMemo, useEffect} from 'react';
import {useChat} from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import type {UIMessage} from 'ai';
import {useStoreWithAi} from '../AiSlice';

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

  // Get chat transport configuration
  const getLocalChatTransport = useStoreWithAi(
    (s) => s.ai.chat.getLocalChatTransport,
  );
  const getRemoteChatTransport = useStoreWithAi(
    (s) => s.ai.chat.getRemoteChatTransport,
  );
  const endPoint = useStoreWithAi((s) => s.ai.chat.endPoint);
  const headers = useStoreWithAi((s) => s.ai.chat.headers);

  // Get chat handlers
  const onChatToolCall = useStoreWithAi((s) => s.ai.chat.onChatToolCall);
  const onChatFinish = useStoreWithAi((s) => s.ai.chat.onChatFinish);
  const onChatError = useStoreWithAi((s) => s.ai.chat.onChatError);
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
  const {messages, sendMessage} = useChat({
    id: sessionId,
    transport,
    messages: (currentSession?.uiMessages as unknown as UIMessage[]) ?? [],
    onToolCall: onChatToolCall,
    onFinish: onChatFinish,
    onError: onChatError,
    // Automatically submit when all tool results are available
    // NOTE: When using sendAutomaticallyWhen, don't use await with addToolResult inside onChatToolCall as it can cause deadlocks.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  // Sync streaming updates into the store so UiMessages renders incrementally
  useEffect(() => {
    if (!sessionId) return;
    setSessionUiMessages(sessionId, messages as UIMessage[]);
  }, [messages, sessionId, setSessionUiMessages]);

  return {
    messages,
    sendMessage,
  };
}
