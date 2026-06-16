import {
  AiRunContextItem,
  ChatSessionSchema,
} from '@sqlrooms/ai-config';
import type {ArtifactMetadata} from '../ArtifactsSliceConfig';

/**
 * Minimal AI session fields needed by artifact ownership helpers.
 */
export type ArtifactAiSession = Pick<
  ChatSessionSchema,
  'id' | 'isRunning' | 'lastOpenedAt'
>;

/**
 * Mapping from AI session id to owning artifact id.
 */
export type ArtifactAiSessionOwnership = Record<string, string>;

/**
 * Input for checking whether a session belongs to a given artifact.
 */
export type ArtifactAiSessionFilterOptions = {
  aiSessionArtifacts: ArtifactAiSessionOwnership;
  sessionId: string;
  artifactId: string | undefined;
};

/**
 * Returns true only when the session is explicitly owned by the artifact.
 *
 * Missing ownership is treated as unowned, not as visible everywhere.
 */
export function isAiSessionVisibleForArtifact({
  aiSessionArtifacts,
  sessionId,
  artifactId,
}: ArtifactAiSessionFilterOptions): boolean;
export function isAiSessionVisibleForArtifact(
  aiSessionArtifacts: ArtifactAiSessionOwnership,
  sessionId: string,
  artifactId: string | undefined,
): boolean;
export function isAiSessionVisibleForArtifact(
  optionsOrAiSessionArtifacts:
    | ArtifactAiSessionFilterOptions
    | ArtifactAiSessionOwnership,
  sessionId?: string,
  artifactId?: string,
): boolean {
  const options =
    typeof sessionId === 'string'
      ? {
          aiSessionArtifacts:
            optionsOrAiSessionArtifacts as ArtifactAiSessionOwnership,
          sessionId,
          artifactId,
        }
      : (optionsOrAiSessionArtifacts as ArtifactAiSessionFilterOptions);
  if (!options.artifactId) return false;
  return options.aiSessionArtifacts[options.sessionId] === options.artifactId;
}

/**
 * Shared input for helpers that select sessions for a single artifact.
 */
export type ArtifactAiSessionsForArtifactOptions = {
  sessions: ArtifactAiSession[];
  aiSessionArtifacts: ArtifactAiSessionOwnership;
  artifactId: string | undefined;
};

/**
 * Returns AI session ids explicitly owned by `artifactId`, preserving the input
 * session order.
 */
export function getAiSessionIdsForArtifact({
  sessions,
  aiSessionArtifacts,
  artifactId,
}: ArtifactAiSessionsForArtifactOptions): string[] {
  if (!artifactId) return [];
  return sessions
    .filter((session) =>
      isAiSessionVisibleForArtifact({
        aiSessionArtifacts,
        sessionId: session.id,
        artifactId,
      }),
    )
    .map((session) => session.id);
}

/**
 * Returns the most recently opened AI session explicitly owned by `artifactId`.
 */
export function getLatestAiSessionIdForArtifact({
  sessions,
  aiSessionArtifacts,
  artifactId,
}: ArtifactAiSessionsForArtifactOptions): string | undefined {
  if (!artifactId) return undefined;
  return sessions
    .filter((session) =>
      isAiSessionVisibleForArtifact({
        aiSessionArtifacts,
        sessionId: session.id,
        artifactId,
      }),
    )
    .sort((a, b) => {
      const aTime = a.lastOpenedAt ?? 0;
      const bTime = b.lastOpenedAt ?? 0;
      return bTime - aTime;
    })[0]?.id;
}

/**
 * Shared input for helpers that derive artifact-level session summaries.
 */
export type ArtifactAiSessionGroupsOptions = {
  sessions: ArtifactAiSession[];
  aiSessionArtifacts: ArtifactAiSessionOwnership;
};

/**
 * Groups explicitly owned AI session ids by artifact id.
 */
export function getAiSessionGroupsByArtifact({
  sessions,
  aiSessionArtifacts,
}: ArtifactAiSessionGroupsOptions): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const session of sessions) {
    const artifactId = aiSessionArtifacts[session.id];
    if (!artifactId) continue;
    if (!groups[artifactId]) {
      groups[artifactId] = [];
    }
    groups[artifactId].push(session.id);
  }
  return groups;
}

/**
 * Counts running AI sessions per owning artifact.
 */
export function getRunningAiSessionCountsByArtifact({
  sessions,
  aiSessionArtifacts,
}: ArtifactAiSessionGroupsOptions): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const session of sessions) {
    if (!session.isRunning) continue;
    const artifactId = aiSessionArtifacts[session.id];
    if (!artifactId) continue;
    counts[artifactId] = (counts[artifactId] ?? 0) + 1;
  }
  return counts;
}

/**
 * Input for removing stale artifact AI ownership entries.
 */
export type CleanupAiSessionArtifactsOptions = {
  aiSessionArtifacts: ArtifactAiSessionOwnership;
  sessions: ArtifactAiSession[];
  artifactIds: Iterable<string>;
};

/**
 * Returns a cleaned ownership map containing only entries whose session and
 * artifact still exist.
 */
export function cleanupAiSessionArtifacts({
  aiSessionArtifacts,
  sessions,
  artifactIds,
}: CleanupAiSessionArtifactsOptions): ArtifactAiSessionOwnership {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const artifactIdSet = new Set(artifactIds);
  return Object.fromEntries(
    Object.entries(aiSessionArtifacts).filter(
      ([sessionId, artifactId]) =>
        sessionIds.has(sessionId) && artifactIdSet.has(artifactId),
    ),
  );
}

function createArtifactContextItem(
  artifact: ArtifactMetadata,
): AiRunContextItem {
  return {
    kind: 'artifact',
    id: artifact.id,
    type: artifact.type,
    title: artifact.title,
  };
}

/**
 * Input for deriving run-context items from artifact AI ownership.
 */
export type GetOwningArtifactRunContextItemsOptions = {
  sessionId: string;
  aiSessionArtifacts: ArtifactAiSessionOwnership;
  artifactsById: Record<string, ArtifactMetadata>;
  /** Explicit context items selected by the user or host app. */
  extraItems?: AiRunContextItem[];
  /** Optional artifact-type allow-list predicate for implicit ownership. */
  isSupportedArtifactType?: (artifactType: string) => boolean;
};

/**
 * Prepends the owning artifact as the implicit primary run-context item.
 *
 * Extra items are deduplicated by id. If the session has no valid supported
 * owning artifact, the extra items are returned unchanged.
 */
export function getOwningArtifactRunContextItems({
  sessionId,
  aiSessionArtifacts,
  artifactsById,
  extraItems = [],
  isSupportedArtifactType,
}: GetOwningArtifactRunContextItemsOptions): AiRunContextItem[] {
  const owningArtifactId = aiSessionArtifacts[sessionId];
  const owningArtifact = owningArtifactId
    ? artifactsById[owningArtifactId]
    : undefined;
  const owningArtifactItem =
    owningArtifact &&
    (!isSupportedArtifactType || isSupportedArtifactType(owningArtifact.type))
      ? createArtifactContextItem(owningArtifact)
      : undefined;

  const items = owningArtifactItem
    ? [
        owningArtifactItem,
        ...extraItems.filter((item) => item.id !== owningArtifactItem.id),
      ]
    : extraItems;

  return Array.from(
    new Map(items.map((item) => [item.id, item] as const)).values(),
  );
}
