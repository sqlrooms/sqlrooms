import type {
  RoomCommandExecuteOutput,
  RoomCommandMiddleware,
  RoomCommandResult,
} from '@sqlrooms/room-shell';
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

function isRoomCommandResult(
  result: RoomCommandExecuteOutput,
): result is RoomCommandResult {
  return Boolean(
    result &&
    typeof result === 'object' &&
    'success' in result &&
    typeof result.success === 'boolean' &&
    'commandId' in result &&
    typeof result.commandId === 'string',
  );
}

/**
 * Keeps an AI-invoked artifact change in the same chat by associating the
 * invoking session with the command's selected artifact.
 *
 * The command must return an `artifactId`, either as raw command data or as
 * normalized `result.data`, and that artifact must be current when the command
 * completes.
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
  const result = await next();
  if (isRoomCommandResult(result) && !result.success) return result;

  const artifactId = getResultArtifactId(
    isRoomCommandResult(result) ? result.data : result,
  );
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

  state.artifactAi.addSessionArtifactLink(sessionId, artifactId);
  if (state.ai.config.currentSessionId !== sessionId) {
    state.ai.switchSession(sessionId);
  }

  return result;
};
