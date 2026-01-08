import {useStoreWithAi} from '../AiSlice';
import {SessionChatProvider} from './SessionChatProvider';

/**
 * SessionChatManager renders SessionChatProvider instances for:
 * - the current session (so the visible UI always has an active chat instance), and
 * - any sessions that are currently running analysis (so stop/cancel targets the correct session).
 *
 * This component should be rendered once at the application root level.
 */
export const SessionChatManager: React.FC = () => {
  const currentSessionId = useStoreWithAi((s) => s.ai.config.currentSessionId);
  const sessions = useStoreWithAi((s) => s.ai.config.sessions);

  // Keep providers alive for sessions that are actively streaming/running, even if the user switches tabs.
  // This avoids "Stop" affecting the wrong session due to only one stop() being registered at a time.
  const sessionIdsToMount = new Set<string>();
  if (currentSessionId) sessionIdsToMount.add(currentSessionId);
  for (const s of sessions) {
    if (s?.id && s.isRunningAnalysis) sessionIdsToMount.add(s.id);
  }

  if (sessionIdsToMount.size === 0) return null;

  return (
    <>
      {Array.from(sessionIdsToMount).map((sessionId) => (
        <SessionChatProvider key={sessionId} sessionId={sessionId} />
      ))}
    </>
  );
};
