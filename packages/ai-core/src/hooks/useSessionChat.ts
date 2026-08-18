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
 * Subscribe to the AI SDK chat controller owned by a session.
 *
 * The AI slice owns the controller lifecycle, so a session can keep running
 * without a mounted React component. This hook only bridges that controller
 * into React.
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
  const getSessionChatController = useStoreWithAi(
    (state) => state.ai.getSessionChatController,
  );
  const controller = requireSessionChatController(
    sessionId,
    getSessionChatController(sessionId),
  );

  const {messages, sendMessage, stop, status} = useChat({
    chat: controller.chat,
  });

  return {messages, sendMessage, stop, status, sessionId};
}

function requireSessionChatController<T>(
  sessionId: string,
  controller: T | undefined,
): T {
  if (!controller) throw new Error(`AI session not found: ${sessionId}`);
  return controller;
}
