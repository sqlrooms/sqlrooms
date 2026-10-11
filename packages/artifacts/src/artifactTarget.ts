import type {RoomCommandInvocation} from '@sqlrooms/room-store';

/**
 * Resolve an optional artifact target for a room command.
 *
 * Explicit command input always wins. AI commands then use the stable target
 * captured for the invoking tool call. Other invocations, and AI invocations
 * without a captured artifact, preserve the live current-artifact fallback.
 */
export function resolveArtifactTargetId(options: {
  requestedArtifactId?: string;
  invocation: Pick<RoomCommandInvocation, 'surface' | 'target'>;
  currentArtifactId?: string;
}): string | undefined {
  if (options.requestedArtifactId !== undefined) {
    return options.requestedArtifactId;
  }
  if (
    options.invocation.surface === 'ai' &&
    options.invocation.target?.kind === 'artifact'
  ) {
    return options.invocation.target.id;
  }
  return options.currentArtifactId;
}
