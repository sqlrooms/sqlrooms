import {
  AiRunContextItem,
  ChatSessionSchema,
  getAiRunContextItems,
} from '@sqlrooms/ai-config';
import type {ArtifactMetadata} from '../ArtifactsSliceConfig';
import type {ArtifactSessionLink} from './ArtifactSessionLink';

/**
 * Minimal AI session fields needed by artifact association helpers.
 */
export type ArtifactAiSession = Pick<
  ChatSessionSchema,
  'id' | 'isRunning' | 'lastOpenedAt'
> &
  Partial<Pick<ChatSessionSchema, 'prompt' | 'uiMessages'>>;

/**
 * AI session fields needed to match artifact-owned sessions by a context item.
 */
export type ArtifactAiSessionWithContext = ArtifactAiSession &
  Partial<Pick<ChatSessionSchema, 'draftContextItemIds' | 'runContext'>>;

/**
 * AI session fields required to prove that a session has no draft text or
 * messages.
 */
export type ArtifactAiSessionWithContent = ArtifactAiSession &
  Pick<ChatSessionSchema, 'prompt' | 'uiMessages'>;

/**
 * Input for checking whether a session belongs to a given artifact.
 */
export type ArtifactAiSessionFilterOptions = {
  sessionArtifactLinks: ArtifactSessionLink[];
  sessionId: string;
  artifactId: string | undefined;
};

/**
 * Returns true only when the session is explicitly linked to the artifact.
 *
 * A missing association is treated as unassociated, not as visible everywhere.
 *
 */
export function isAiSessionVisibleForArtifact({
  sessionArtifactLinks,
  sessionId,
  artifactId,
}: ArtifactAiSessionFilterOptions): boolean {
  if (!artifactId) return false;
  return sessionArtifactLinks.some(
    (link) => link.sessionId === sessionId && link.artifactId === artifactId,
  );
}

/**
 * Shared input for helpers that select sessions for a single artifact.
 */
export type ArtifactAiSessionsForArtifactOptions = {
  sessions: ArtifactAiSession[];
  sessionArtifactLinks: ArtifactSessionLink[];
  artifactId: string | undefined;
  /** Session ids to ignore when selecting a session. */
  excludeSessionIds?: Iterable<string>;
};

/**
 * Input for selecting reusable empty sessions. Callers must provide message
 * fields; summaries without `prompt` and `uiMessages` are not enough to prove a
 * session is empty.
 */
export type EmptyArtifactAiSessionsForArtifactOptions = Omit<
  ArtifactAiSessionsForArtifactOptions,
  'sessions'
> & {
  sessions: ArtifactAiSessionWithContent[];
};

/**
 * Input for selecting an artifact-owned session that already references a
 * specific context item.
 */
export type ArtifactAiSessionsWithContextForArtifactOptions = Omit<
  ArtifactAiSessionsForArtifactOptions,
  'sessions'
> & {
  sessions: ArtifactAiSessionWithContext[];
  contextItemId: string;
  /** Include currently running sessions in the search. Defaults to false. */
  includeRunning?: boolean;
};

/**
 * Returns AI session ids explicitly linked to `artifactId`, preserving the input
 * session order.
 *
 */
export function getAiSessionIdsForArtifact({
  sessions,
  sessionArtifactLinks,
  artifactId,
}: ArtifactAiSessionsForArtifactOptions): string[] {
  if (!artifactId) return [];
  return sessions
    .filter((session) =>
      isAiSessionVisibleForArtifact({
        sessionArtifactLinks,
        sessionId: session.id,
        artifactId,
      }),
    )
    .map((session) => session.id);
}

/**
 * Returns the most recently opened AI session explicitly linked to `artifactId`.
 *
 */
export function getLatestAiSessionIdForArtifact({
  sessions,
  sessionArtifactLinks,
  artifactId,
}: ArtifactAiSessionsForArtifactOptions): string | undefined {
  if (!artifactId) return undefined;

  const linkedSessionIds = new Set(
    sessionArtifactLinks
      .filter((link) => link.artifactId === artifactId)
      .map((link) => link.sessionId),
  );

  // Sort by session.lastOpenedAt (not link.linkedAt)
  return sessions
    .filter((session) => linkedSessionIds.has(session.id))
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0]?.id;
}

function sessionHasContextItem(
  session: ArtifactAiSessionWithContext,
  contextItemId: string,
): boolean {
  if (session.draftContextItemIds?.includes(contextItemId)) {
    return true;
  }

  return getAiRunContextItems(session.runContext).some(
    (item) => item.id === contextItemId,
  );
}

/**
 * Returns the latest artifact-owned AI session whose draft or last run context
 * contains a specific context item.
 */
export function findAiSessionForArtifactWithContextItem({
  sessions,
  sessionArtifactLinks,
  artifactId,
  contextItemId,
  includeRunning = false,
}: ArtifactAiSessionsWithContextForArtifactOptions): string | undefined {
  if (!artifactId) return undefined;
  return sessions
    .filter((session) => {
      if (!includeRunning && session.isRunning) return false;
      if (
        !isAiSessionVisibleForArtifact({
          sessionArtifactLinks,
          sessionId: session.id,
          artifactId,
        })
      ) {
        return false;
      }
      return sessionHasContextItem(session, contextItemId);
    })
    .sort((a, b) => {
      const aTime = a.lastOpenedAt ?? 0;
      const bTime = b.lastOpenedAt ?? 0;
      return bTime - aTime;
    })[0]?.id;
}

/**
 * Returns the most recently opened empty AI session explicitly owned by
 * `artifactId`.
 *
 * An empty session is not running, has no UI messages, and has no prompt text
 * after trimming whitespace.
 *
 * @param options - Session selection options.
 * @param options.sessions - Available sessions to search.
 * @param options.sessionArtifactLinks - Session-to-artifact links.
 * @param options.artifactId - Artifact whose sessions should be searched.
 * @param options.excludeSessionIds - Session IDs to skip during selection.
 * @returns The most recently opened empty session ID, or `undefined` if none match.
 */
export function getEmptyAiSessionIdForArtifact({
  sessions,
  sessionArtifactLinks,
  artifactId,
  excludeSessionIds,
}: EmptyArtifactAiSessionsForArtifactOptions): string | undefined {
  if (!artifactId) return undefined;
  const excludedSessionIds = new Set(excludeSessionIds);
  return sessions
    .filter((session) => {
      if (excludedSessionIds.has(session.id)) return false;
      if (
        !isAiSessionVisibleForArtifact({
          sessionArtifactLinks,
          sessionId: session.id,
          artifactId,
        })
      ) {
        return false;
      }
      return (
        !session.isRunning &&
        Array.isArray(session.uiMessages) &&
        typeof session.prompt === 'string' &&
        session.uiMessages.length === 0 &&
        session.prompt.trim().length === 0
      );
    })
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
  sessions?: ArtifactAiSession[];
  sessionArtifactLinks: ArtifactSessionLink[];
};

/**
 * Groups explicitly linked AI session ids by artifact id.
 *
 */
export function getAiSessionGroupsByArtifact({
  sessions,
  sessionArtifactLinks,
}: ArtifactAiSessionGroupsOptions): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  // When the caller passes `sessions`, drop links pointing at sessions that no
  // longer exist. A stale link to a deleted session would otherwise surface a
  // phantom session id in the group. When `sessions` is omitted, all links are
  // kept (the caller has opted out of existence filtering).
  const knownSessionIds = sessions
    ? new Set(sessions.map((session) => session.id))
    : undefined;
  for (const link of sessionArtifactLinks) {
    if (knownSessionIds && !knownSessionIds.has(link.sessionId)) continue;

    const item = groups[link.artifactId] ?? [];
    item.push(link.sessionId);
    groups[link.artifactId] = item;
  }

  return groups;
}

/**
 * Counts running AI sessions per owning artifact.
 *
 */
export function getRunningAiSessionCountsByArtifact({
  sessions,
  sessionArtifactLinks,
}: Required<ArtifactAiSessionGroupsOptions>): Record<string, number> {
  const counts: Record<string, number> = {};
  const runningSessions = new Set(
    sessions.filter((s) => s.isRunning).map((s) => s.id),
  );

  for (const link of sessionArtifactLinks) {
    if (runningSessions.has(link.sessionId)) {
      counts[link.artifactId] = (counts[link.artifactId] ?? 0) + 1;
    }
  }

  return counts;
}

/**
 * Input for removing stale artifact AI associations.
 */
export type CleanupSessionArtifactLinksOptions = {
  sessionArtifactLinks: ArtifactSessionLink[];
  sessions: ArtifactAiSession[];
  artifactIds: Iterable<string>;
};

/**
 * Returns links whose session and
 * artifact still exist.
 */
export function cleanupSessionArtifactLinks({
  sessionArtifactLinks,
  sessions,
  artifactIds,
}: CleanupSessionArtifactLinksOptions): ArtifactSessionLink[] {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const artifactIdSet = new Set(artifactIds);

  return sessionArtifactLinks.filter(
    (link) =>
      sessionIds.has(link.sessionId) && artifactIdSet.has(link.artifactId),
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
 * Input for deriving run-context items from artifact AI associations.
 */
export type GetOwningArtifactRunContextItemsOptions = {
  sessionId: string;
  sessionArtifactLinks: ArtifactSessionLink[];
  artifactsById: Record<string, ArtifactMetadata>;
  /** Explicit context items selected by the user or host app. */
  extraItems?: AiRunContextItem[];
  /** Optional artifact-type allow-list predicate for implicit associations. */
  isSupportedArtifactType?: (artifactType: string) => boolean;
  /**
   * Artifact the run is being initiated from (for example the currently
   * selected artifact). When the session is linked to this artifact it is used
   * as the primary owning artifact instead of the most recently linked one, so
   * asking AI from an older linked artifact directs the run at that artifact.
   * Ignored when the session is not linked to it.
   */
  preferredArtifactId?: string;
};

/**
 * Prepends the owning artifact as the implicit primary run-context item.
 *
 * Extra items are deduplicated by id. If the session has no valid supported
 * owning artifact, the extra items are returned unchanged.
 *
 * When `preferredArtifactId` is provided and the session is linked to it, that
 * artifact becomes the primary run context. Otherwise the most recently linked
 * artifact is used.
 *
 */
export function getOwningArtifactRunContextItems({
  sessionId,
  sessionArtifactLinks,
  artifactsById,
  extraItems = [],
  isSupportedArtifactType,
  preferredArtifactId,
}: GetOwningArtifactRunContextItemsOptions): AiRunContextItem[] {
  const preferredIsLinked =
    preferredArtifactId !== undefined &&
    sessionArtifactLinks.some(
      (link) =>
        link.sessionId === sessionId && link.artifactId === preferredArtifactId,
    );
  const owningArtifactId = preferredIsLinked
    ? preferredArtifactId
    : getLatestArtifactIdForAiSession({
        sessionArtifactLinks,
        sessionId,
      });

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

/**
 * Returns all artifact IDs associated with a given AI session.
 * Preserves order by linkedAt (oldest first).
 */
export function getArtifactIdsForAiSession({
  sessionArtifactLinks,
  sessionId,
}: {
  sessionArtifactLinks: ArtifactSessionLink[];
  sessionId: string;
}): string[] {
  return sessionArtifactLinks
    .filter((link) => link.sessionId === sessionId)
    .sort((a, b) => a.linkedAt - b.linkedAt)
    .map((link) => link.artifactId);
}

/**
 * Returns the most recently linked artifact for a given AI session.
 * Returns undefined if session has no artifacts.
 */
export function getLatestArtifactIdForAiSession({
  sessionArtifactLinks,
  sessionId,
}: {
  sessionArtifactLinks: ArtifactSessionLink[];
  sessionId: string;
}): string | undefined {
  return sessionArtifactLinks
    .filter((link) => link.sessionId === sessionId)
    .sort((a, b) => b.linkedAt - a.linkedAt)[0]?.artifactId;
}
