import {useStoreWithAi} from '../AiSlice';
import {SessionChatProvider} from './SessionChatProvider';

/**
 * SessionChatManager renders a SessionChatProvider for each session.
 * This ensures that every session has its own independent useChat instance,
 * allowing multiple sessions to stream concurrently without interfering with each other.
 *
 * This component should be rendered once at the application root level.
 */
export const SessionChatManager: React.FC = () => {
  const sessions = useStoreWithAi((s) => s.ai.config.sessions);

  return (
    <>
      {sessions.map((session) => (
        <SessionChatProvider key={session.id} sessionId={session.id} />
      ))}
    </>
  );
};
