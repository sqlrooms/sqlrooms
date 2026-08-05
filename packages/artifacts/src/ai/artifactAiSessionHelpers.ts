import {
  AiRunContextItem,
  ChatSessionSchema,
  getAiRunContextItems,
} from '@sqlrooms/ai-config';
import type {
  ArtifactMetadata,
  ArtifactSessionLink,
} from '../ArtifactsSliceConfig';

/**
 * Minimal AI session fields needed by artifact ownership helpers.
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
 * Returns true only when the session is explicitly linked to the artifact.
 *
 * Missing ownership is treated as unowned, not as visible everywhere.
 *
 * Supports both old format (aiSessionArtifacts) and new format (sessionArtifactLinks).
 */
export function isAiSessionVisibleForArtifact({
  aiSessionArtifacts,
  sessionArtifactLinks,
  sessionId,
  artifactId,
}: {
  aiSessionArtifacts?: ArtifactAiSessionOwnership;
  sessionArtifactLinks?: ArtifactSessionLink[];
  sessionId: string;
  artifactId: string | undefined;
}): boolean;
export function isAiSessionVisibleForArtifact(
  aiSessionArtifacts: ArtifactAiSessionOwnership,
  sessionId: string,
  artifactId: string | undefined,
): boolean;
export function isAiSessionVisibleForArtifact(
  optionsOrAiSessionArtifacts:
    | {
        aiSessionArtifacts?: ArtifactAiSessionOwnership;
        sessionArtifactLinks?: ArtifactSessionLink[];
        sessionId: string;
        artifactId: string | undefined;
      }
    | ArtifactAiSessionOwnership,
  sessionId?: string,
  artifactId?: string,
): boolean {
  // Handle old-style function call
  if (typeof sessionId === 'string') {
    const aiSessionArtifacts =
      optionsOrAiSessionArtifacts as ArtifactAiSessionOwnership;
    if (!artifactId) return false;
    return aiSessionArtifacts[sessionId] === artifactId;
  }

  // Handle new-style options object
  const options = optionsOrAiSessionArtifacts as {
    aiSessionArtifacts?: ArtifactAiSessionOwnership;
    sessionArtifactLinks?: ArtifactSessionLink[];
    sessionId: string;
    artifactId: string | undefined;
  };

  if (!options.artifactId) return false;

  // Try new format first
  if (options.sessionArtifactLinks) {
    return options.sessionArtifactLinks.some(
      (link) =>
        link.sessionId === options.sessionId &&
        link.artifactId === options.artifactId,
    );
  }

  // Fall back to old format
  if (options.aiSessionArtifacts) {
    return options.aiSessionArtifacts[options.sessionId] === options.artifactId;
  }

  return false;
}

/**
 * Shared input for helpers that select sessions for a single artifact.
 */
export type ArtifactAiSessionsForArtifactOptions = {
  sessions: ArtifactAiSession[];
  aiSessionArtifacts?: ArtifactAiSessionOwnership;
  sessionArtifactLinks?: ArtifactSessionLink[];
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
 * Supports both old format (aiSessionArtifacts) and new format (sessionArtifactLinks).
 */
export function getAiSessionIdsForArtifact({
  sessions,
  aiSessionArtifacts,
  sessionArtifactLinks,
  artifactId,
}: {
  sessions: ArtifactAiSession[];
  aiSessionArtifacts?: ArtifactAiSessionOwnership;
  sessionArtifactLinks?: ArtifactSessionLink[];
  artifactId: string | undefined;
}): string[] {
  if (!artifactId) return [];
  return sessions
    .filter((session) =>
      isAiSessionVisibleForArtifact({
        aiSessionArtifacts,
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
 * Supports both old format (aiSessionArtifacts) and new format (sessionArtifactLinks).
 */
export function getLatestAiSessionIdForArtifact({
  sessions,
  aiSessionArtifacts,
  sessionArtifactLinks,
  artifactId,
}: {
  sessions: ArtifactAiSession[];
  aiSessionArtifacts?: ArtifactAiSessionOwnership;
  sessionArtifactLinks?: ArtifactSessionLink[];
  artifactId: string | undefined;
}): string | undefined {
  if (!artifactId) return undefined;

  // Get all linked session IDs
  let linkedSessionIds: Set<string>;
  if (sessionArtifactLinks) {
    linkedSessionIds = new Set(
      sessionArtifactLinks
        .filter((link) => link.artifactId === artifactId)
        .map((link) => link.sessionId),
    );
  } else if (aiSessionArtifacts) {
    linkedSessionIds = new Set(
      Object.entries(aiSessionArtifacts)
        .filter(([, artId]) => artId === artifactId)
        .map(([sessId]) => sessId),
    );
  } else {
    return undefined;
  }

  // Sort by session.lastOpenedAt (not link.createdAt)
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
  aiSessionArtifacts,
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
          aiSessionArtifacts,
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
 * @param options.aiSessionArtifacts - Session-to-artifact ownership mapping.
 * @param options.artifactId - Artifact whose sessions should be searched.
 * @param options.excludeSessionIds - Session IDs to skip during selection.
 * @returns The most recently opened empty session ID, or `undefined` if none match.
 */
export function getEmptyAiSessionIdForArtifact({
  sessions,
  aiSessionArtifacts,
  sessionArtifactLinks,
  artifactId,
  excludeSessionIds,
}: {
  sessions: ArtifactAiSessionWithContent[];
  aiSessionArtifacts?: ArtifactAiSessionOwnership;
  sessionArtifactLinks?: ArtifactSessionLink[];
  artifactId: string | undefined;
  excludeSessionIds?: Iterable<string>;
}): string | undefined {
  if (!artifactId) return undefined;
  const excludedSessionIds = new Set(excludeSessionIds);
  return sessions
    .filter((session) => {
      if (excludedSessionIds.has(session.id)) return false;
      if (
        !isAiSessionVisibleForArtifact({
          aiSessionArtifacts,
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
  sessions: ArtifactAiSession[];
  aiSessionArtifacts: ArtifactAiSessionOwnership;
};

/**
 * Groups explicitly linked AI session ids by artifact id.
 *
 * Supports both old format (aiSessionArtifacts) and new format (sessionArtifactLinks).
 */
export function getAiSessionGroupsByArtifact({
  sessions,
  aiSessionArtifacts,
  sessionArtifactLinks,
}: {
  sessions?: ArtifactAiSession[];
  aiSessionArtifacts?: ArtifactAiSessionOwnership;
  sessionArtifactLinks?: ArtifactSessionLink[];
}): Record<string, string[]> {
  const groups: Record<string, string[]> = {};

  if (sessionArtifactLinks) {
    for (const link of sessionArtifactLinks) {
      const item = groups[link.artifactId] ?? [];

      item.push(link.sessionId);

      groups[link.artifactId] = item;
    }
  } else if (aiSessionArtifacts && sessions) {
    for (const session of sessions) {
      const artifactId = aiSessionArtifacts[session.id];
      if (!artifactId) continue;
      if (!groups[artifactId]) {
        groups[artifactId] = [];
      }
      groups[artifactId].push(session.id);
    }
  }

  return groups;
}

/**
 * Counts running AI sessions per owning artifact.
 *
 * Supports both old format (aiSessionArtifacts) and new format (sessionArtifactLinks).
 */
export function getRunningAiSessionCountsByArtifact({
  sessions,
  aiSessionArtifacts,
  sessionArtifactLinks,
}: {
  sessions: ArtifactAiSession[];
  aiSessionArtifacts?: ArtifactAiSessionOwnership;
  sessionArtifactLinks?: ArtifactSessionLink[];
}): Record<string, number> {
  const counts: Record<string, number> = {};
  const runningSessions = new Set(
    sessions.filter((s) => s.isRunning).map((s) => s.id),
  );

  if (sessionArtifactLinks) {
    for (const link of sessionArtifactLinks) {
      if (runningSessions.has(link.sessionId)) {
        counts[link.artifactId] = (counts[link.artifactId] ?? 0) + 1;
      }
    }
  } else if (aiSessionArtifacts) {
    for (const session of sessions) {
      if (!session.isRunning) continue;
      const artifactId = aiSessionArtifacts[session.id];
      if (!artifactId) continue;
      counts[artifactId] = (counts[artifactId] ?? 0) + 1;
    }
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
 * Returns a cleaned ownership structure containing only entries whose session and
 * artifact still exist.
 *
 * Supports both old format (returning Record) and new format (returning array).
 */
export function cleanupAiSessionArtifacts({
  aiSessionArtifacts,
  sessionArtifactLinks,
  sessions,
  artifactIds,
}: {
  aiSessionArtifacts?: ArtifactAiSessionOwnership;
  sessionArtifactLinks?: ArtifactSessionLink[];
  sessions: ArtifactAiSession[];
  artifactIds: Iterable<string>;
}): ArtifactAiSessionOwnership | ArtifactSessionLink[] {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const artifactIdSet = new Set(artifactIds);

  if (sessionArtifactLinks) {
    return sessionArtifactLinks.filter(
      (link) =>
        sessionIds.has(link.sessionId) && artifactIdSet.has(link.artifactId),
    );
  }

  if (aiSessionArtifacts) {
    return Object.fromEntries(
      Object.entries(aiSessionArtifacts).filter(
        ([sessionId, artifactId]) =>
          sessionIds.has(sessionId) && artifactIdSet.has(artifactId),
      ),
    );
  }

  return [];
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
  aiSessionArtifacts?: ArtifactAiSessionOwnership;
  sessionArtifactLinks?: ArtifactSessionLink[];
  artifactsById: Record<string, ArtifactMetadata>;
  /** Explicit context items selected by the user or host app. */
  extraItems?: AiRunContextItem[];
  /** Optional artifact-type allow-list predicate for implicit ownership. */
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
 * Supports both old format (aiSessionArtifacts) and new format (sessionArtifactLinks).
 */
export function getOwningArtifactRunContextItems({
  sessionId,
  aiSessionArtifacts,
  sessionArtifactLinks,
  artifactsById,
  extraItems = [],
  isSupportedArtifactType,
  preferredArtifactId,
}: GetOwningArtifactRunContextItemsOptions): AiRunContextItem[] {
  // Try new format first
  let owningArtifactId: string | undefined;
  if (sessionArtifactLinks) {
    const preferredIsLinked =
      preferredArtifactId !== undefined &&
      sessionArtifactLinks.some(
        (link) =>
          link.sessionId === sessionId &&
          link.artifactId === preferredArtifactId,
      );
    owningArtifactId = preferredIsLinked
      ? preferredArtifactId
      : getLatestArtifactIdForAiSession({
          sessionArtifactLinks,
          sessionId,
        });
  } else if (aiSessionArtifacts) {
    owningArtifactId = aiSessionArtifacts[sessionId];
  }

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
 * Preserves order by createdAt (oldest first).
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
    .sort((a, b) => a.createdAt - b.createdAt)
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
    .sort((a, b) => b.createdAt - a.createdAt)[0]?.artifactId;
}

/**
 * Returns the session that created this artifact (linkType: 'created').
 * Returns undefined if artifact was not created by any session.
 */
export function getCreatorSessionIdForArtifact({
  sessionArtifactLinks,
  artifactId,
}: {
  sessionArtifactLinks: ArtifactSessionLink[];
  artifactId: string;
}): string | undefined {
  return sessionArtifactLinks.find(
    (link) => link.artifactId === artifactId && link.linkType === 'created',
  )?.sessionId;
}
