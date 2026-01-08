import {useEffect} from 'react';
import {useSessionChat} from '../hooks/useSessionChat';

/**
 * SessionChatProvider manages a useChat instance for a specific session.
 * This component should be rendered for each active session to ensure
 * independent chat streams.
 *
 * @param sessionId - The ID of the session to manage
 * @param children - Optional children to render (typically not needed)
 */
export const SessionChatProvider: React.FC<{
  sessionId: string;
  children?: React.ReactNode;
}> = ({sessionId, children}) => {
  // Initialize and manage the chat instance for this session
  const {messages, status, stop} = useSessionChat(sessionId);

  // Log for debugging (can be removed in production)
  useEffect(() => {
    console.log(
      `[SessionChatProvider] Session ${sessionId}: ${messages.length} messages, status: ${status}`,
    );
  }, [sessionId, messages.length, status]);

  // On session switch/unmount, stop any in-flight stream to avoid late callbacks
  // writing into the newly active session.
  useEffect(() => {
    return () => {
      try {
        stop();
      } catch {
        // no-op
      }
    };
  }, [stop]);

  // This component primarily exists to instantiate the useSessionChat hook
  // It doesn't render any visible UI
  return <>{children}</>;
};
