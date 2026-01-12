import {useEffect} from 'react';
import {useSessionChat} from '../hooks/useSessionChat';

/**
 * SessionChatProvider manages a useChat instance for a specific session.
 * This component should be rendered for each active session to ensure
 * independent chat streams.
 *
 * @param sessionId - The ID of the session to manage
 * @param children - Optional children to render
 */
export const SessionChatProvider: React.FC<{
  sessionId: string;
  children?: React.ReactNode;
}> = ({sessionId, children}) => {
  // Initialize and manage the chat instance for this session
  const {stop} = useSessionChat(sessionId);

  // Cleanup: when this provider unmounts (e.g. switching away from a non-running session,
  // or deleting the session) or when the underlying useChat instance is recreated (stop changes),
  // cancel any in-flight stream so late chunks don't get applied after the session is no longer active.
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
