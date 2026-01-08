import {useStoreWithAi} from '../AiSlice';
import {SessionChatProvider} from './SessionChatProvider';

/**
 * SessionChatManager renders a SessionChatProvider only for the current session.
 * This ensures that each session has its own independent useChat instance,
 * and prevents message contamination between sessions.
 *
 * This component should be rendered once at the application root level.
 */
export const SessionChatManager: React.FC = () => {
  const currentSessionId = useStoreWithAi((s) => s.ai.config.currentSessionId);

  // Only render the provider for the current session
  // This prevents multiple useChat instances from interfering with each other
  return currentSessionId ? (
    <SessionChatProvider key={currentSessionId} sessionId={currentSessionId} />
  ) : null;
};
