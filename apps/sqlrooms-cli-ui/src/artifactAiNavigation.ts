import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';

/**
 * Switches to an artifact-owned AI session, selecting its owning artifact first.
 *
 * Artifact/session auto-sync is driven by the current artifact, so switching the
 * session before the artifact can be immediately overwritten by sync.
 */
export function switchToArtifactAiSession(
  store: StoreApi<RoomState>,
  sessionId: string,
) {
  const state = store.getState();
  const sessionExists = state.ai.config.sessions.some(
    (session) => session.id === sessionId,
  );
  if (!sessionExists) return false;

  const artifactId = state.artifactAi.getSessionArtifactId(sessionId);
  if (artifactId && state.artifacts.getArtifact(artifactId)) {
    state.artifacts.setCurrentArtifact(artifactId);
  }

  store.getState().ai.switchSession(sessionId);
  return true;
}
