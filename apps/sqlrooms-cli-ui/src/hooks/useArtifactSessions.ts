import type {ChatSessionSchema} from '@sqlrooms/ai';
import {getAiSessionIdsForArtifact} from '@sqlrooms/artifacts/ai';
import {useMemo} from 'react';
import {useRoomStore} from '../roomStoreHooks';

/** Returns the chats linked to an artifact in room session order. */
export function useArtifactSessions(artifactId?: string): ChatSessionSchema[] {
  const sessions = useRoomStore((state) => state.ai.config.sessions);
  const sessionArtifactLinks = useRoomStore(
    (state) => state.artifactAi.config.sessionArtifactLinks,
  );

  return useMemo(() => {
    if (!artifactId) return [];
    const sessionIds = new Set(
      getAiSessionIdsForArtifact({
        sessions,
        sessionArtifactLinks,
        artifactId,
      }),
    );
    return sessions.filter((session) => sessionIds.has(session.id));
  }, [artifactId, sessionArtifactLinks, sessions]);
}
