import type {RoomCommandMiddleware} from '@sqlrooms/room-shell';
import type {RoomState} from './store-types';

function getInvokingAiSessionId(metadata?: Record<string, unknown>) {
  const sessionId = metadata?.aiSessionId;
  return typeof sessionId === 'string' ? sessionId : undefined;
}

function getResultArtifactId(data: unknown) {
  if (!data || typeof data !== 'object') return undefined;
  const artifactId = (data as {artifactId?: unknown}).artifactId;
  return typeof artifactId === 'string' ? artifactId : undefined;
}

/**
 * Keeps an AI-invoked artifact change in the same chat by associating the
 * invoking session with the command's selected artifact.
 *
 * The command must return `data.artifactId`, and that artifact must be current
 * when the command completes. Newly created artifacts receive a `created`
 * link; existing artifacts receive an `attached` link.
 */
export const artifactChatAssociationMiddleware: RoomCommandMiddleware<
  RoomState
> = async (_command, _input, context, next) => {
  const sessionId = getInvokingAiSessionId(context.invocation.metadata);
  if (context.invocation.surface !== 'ai' || !sessionId) {
    return next();
  }

  const stateBefore = context.getState();
  const previousArtifactId = stateBefore.artifacts.config.currentArtifactId;
  const artifactIdsBefore = new Set(
    Object.keys(stateBefore.artifacts.config.artifactsById),
  );

  const result = await next();
  if (!result.success) return result;

  const artifactId = getResultArtifactId(result.data);
  const state = context.getState();
  if (
    !artifactId ||
    artifactId === previousArtifactId ||
    artifactId !== state.artifacts.config.currentArtifactId ||
    !state.artifacts.getArtifact(artifactId) ||
    !state.ai.config.sessions.some((session) => session.id === sessionId)
  ) {
    return result;
  }

  state.artifactAi.addSessionArtifactLink(
    sessionId,
    artifactId,
    artifactIdsBefore.has(artifactId) ? 'attached' : 'created',
  );
  if (state.ai.config.currentSessionId !== sessionId) {
    state.ai.switchSession(sessionId);
  }

  return result;
};
