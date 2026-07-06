import type {StoreApi} from 'zustand';
import type {RoomStateWithArtifactAi} from './artifactAiSlice';

/**
 * Switches to an artifact-owned AI session, selecting its owning artifact first.
 *
 * Artifact/session auto-sync is driven by the current artifact, so switching the
 * session before the artifact can be immediately overwritten by sync.
 *
 * @param store - Store containing artifact and AI session state.
 * @param sessionId - AI session id to switch to.
 * @returns `true` when the session exists and was selected.
 */
export function switchToArtifactAiSession<
  TState extends RoomStateWithArtifactAi,
>(store: Pick<StoreApi<TState>, 'getState'>, sessionId: string) {
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
