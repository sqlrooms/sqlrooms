import {useChat} from '@ai-sdk/react';
import type {AbstractChat, ChatStatus, UIMessage} from 'ai';
import {useStoreWithAi} from '../AiSlice';

export type {AddToolOutput} from '../types';

/** Return type for the useSessionChat hook. */
export type UseSessionChatResult = {
  messages: UIMessage[];
  sendMessage: AbstractChat<UIMessage>['sendMessage'];
  stop: AbstractChat<UIMessage>['stop'];
  status: ChatStatus;
  sessionId: string;
};

/**
 * Subscribe to the AI SDK chat owned by a session runtime.
 *
 * The AI slice owns the runtime lifecycle, so a session can keep running
 * without a mounted React component. This hook only bridges its chat into
 * React.
 *
 * @param sessionId - The ID of the session to observe.
 * @returns Messages and imperative chat methods for the session.
 */
export function useSessionChat(sessionId: string): UseSessionChatResult {
  // A revision change intentionally replaces the controller and its SDK chat.
  useStoreWithAi(
    (state) =>
      state.ai.config.sessions.find((session) => session.id === sessionId)
        ?.messagesRevision,
  );
  const getSessionChat = useStoreWithAi((state) => state.ai.getSessionChat);
  const chat = requireSessionChat(sessionId, getSessionChat(sessionId));

  const {messages, sendMessage, stop, status} = useChat({
    chat,
  });

  return {messages, sendMessage, stop, status, sessionId};
}

function requireSessionChat<T>(sessionId: string, chat: T | undefined): T {
  if (!chat) throw new Error(`AI session not found: ${sessionId}`);
  return chat;
}
