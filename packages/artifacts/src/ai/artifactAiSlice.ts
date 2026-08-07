/**
 * Artifact-owned AI session slice for apps that compose `@sqlrooms/artifacts`
 * with `@sqlrooms/ai`.
 *
 * The generic AI session schema intentionally does not know about artifacts.
 * This module keeps artifact relationships in a small companion slice.
 *
 * @packageDocumentation
 */

import {ChatSessionSchema} from '@sqlrooms/ai-config';
import {
  BaseRoomStoreState,
  createSlice,
  SliceFunctions,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {StoreApi} from 'zustand';
import {z} from 'zod';
import type {ArtifactsSliceState} from '../ArtifactsSlice';
import {
  ArtifactSessionLinkSchema,
  type ArtifactSessionLinkType,
} from '../ArtifactsSliceConfig';
import {
  cleanupSessionArtifactLinks,
  getLatestAiSessionIdForArtifact,
  getArtifactIdsForAiSession,
  getLatestArtifactIdForAiSession,
  getCreatorSessionIdForArtifact,
} from './artifactAiSessionHelpers';

/**
 * Persisted configuration for artifact-owned AI sessions.
 *
 * `sessionArtifactLinks` is an array of links between sessions and artifacts,
 * each with metadata (createdAt, linkType).
 */
export const ArtifactAiConfig = z
  .object({
    sessionArtifactLinks: z.array(ArtifactSessionLinkSchema).default([]),
    /** IDs of pinned artifacts */
    pinnedArtifactIds: z.array(z.string()).optional(),
  })
  .strict();
export type ArtifactAiConfig = z.infer<typeof ArtifactAiConfig>;
export const ArtifactAiConfigSchema = ArtifactAiConfig;

/**
 * Slice state for artifact-owned AI sessions.
 *
 * The slice coordinates the current artifact with the current AI session while
 * leaving the base AI session schema unchanged.
 */
export type ArtifactAiSliceState = {
  artifactAi: SliceFunctions & {
    config: ArtifactAiConfig;
    setConfig: (config: z.input<typeof ArtifactAiConfig>) => void;

    addSessionArtifactLink: (
      sessionId: string,
      artifactId: string,
      linkType: ArtifactSessionLinkType,
    ) => void;
    removeSessionArtifactLink: (sessionId: string, artifactId: string) => void;
    removeAllLinksForSession: (sessionId: string) => void;
    removeAllLinksForArtifact: (artifactId: string) => void;
    hasSessionArtifactLink: (sessionId: string, artifactId: string) => boolean;
    getArtifactIdsForSession: (sessionId: string) => string[];
    getSessionIdsForArtifact: (artifactId: string) => string[];
    getLatestArtifactForSession: (sessionId: string) => string | undefined;
    getCreatorSessionForArtifact: (artifactId: string) => string | undefined;
    togglePinArtifact: (artifactId: string) => void;
    isPinnedArtifact: (artifactId: string) => boolean;

    createArtifactScopedSession: (
      name?: string,
      modelProvider?: string,
      model?: string,
    ) => string | undefined;
    selectLatestSessionForArtifact: (artifactId?: string) => void;
    cleanupSessionArtifacts: () => void;
    syncCurrentArtifactAiSession: () => void;
    /**
     * Suspend or resume the current-artifact/current-session auto-sync.
     *
     * Use this to wrap bulk, non-atomic state updates (e.g. project
     * hydration, where the artifact config, AI sessions, and
     * `sessionArtifactLinks` are restored in separate `set()` calls). While
     * suspended, the auto-sync subscription becomes a no-op so it cannot
     * observe a partially-restored state and clobber the restored selection.
     *
     * Resuming (`suspended === false`) re-baselines the internal
     * previous-artifact/previous-session pointers to the current selection so
     * the next genuine change is measured against the fully-settled state
     * rather than a stale/undefined baseline.
     */
    setSyncSuspended: (suspended: boolean) => void;
  };
};

type ArtifactAiCompatibleAiState = {
  ai: {
    config: {
      sessions: ChatSessionSchema[];
      currentSessionId?: string;
      sessionForks?: Record<string, {sourceSessionId: string}>;
    };
    createSession: (
      name?: string,
      modelProvider?: string,
      model?: string,
    ) => void;
    switchSession: (sessionId: string) => void;
    getCurrentSession: () => ChatSessionSchema | undefined;
  };
};

export type RoomStateWithArtifactAi = BaseRoomStoreState &
  ArtifactsSliceState &
  ArtifactAiSliceState &
  ArtifactAiCompatibleAiState;

/**
 * Minimal state observed by the artifact AI auto-sync subscription.
 *
 * The slice uses this snapshot to avoid running session/artifact alignment for
 * unrelated room-store updates while still reacting to artifact selection, AI
 * session config, artifact registry, and session ownership changes.
 */
type ArtifactAiSyncSnapshot = {
  currentArtifactId?: string;
  artifactsById: RoomStateWithArtifactAi['artifacts']['config']['artifactsById'];
  aiConfig: ArtifactAiCompatibleAiState['ai']['config'];
  sessionArtifactLinks: ArtifactAiConfig['sessionArtifactLinks'];
};

export type CreateArtifactAiSliceOptions = {
  /** Initial or persisted artifact AI config. */
  config?: z.input<typeof ArtifactAiConfig>;
  /**
   * Whether the slice should subscribe to store changes and keep current
   * artifact/current session alignment up to date.
   *
   * Disable this in focused tests or when a host app wants to call
   * `syncCurrentArtifactAiSession` manually.
   */
  autoSync?: boolean;
};

/**
 * Creates the artifact AI companion slice.
 *
 * Compose this with `createArtifactsSlice` and `createAiSlice` when a room wants
 * AI chats to be scoped to the currently selected artifact. The slice stores
 * ownership separately from AI sessions, creates artifact-scoped sessions, and
 * keeps the current AI session aligned with `artifacts.config.currentArtifactId`.
 */
export function createArtifactAiSlice<
  TRoomState extends RoomStateWithArtifactAi = RoomStateWithArtifactAi,
>(options: CreateArtifactAiSliceOptions = {}) {
  const autoSync = options.autoSync ?? true;
  let artifactAiSyncing = false;
  let artifactAiSyncSuspended = false;
  let unsubscribe: (() => void) | undefined;
  let previousArtifactId: string | undefined;
  let previousSessionId: string | undefined;

  return createSlice<ArtifactAiSliceState, TRoomState>((set, get, store) => {
    const getArtifactAiSyncSnapshot = (
      state: TRoomState,
    ): ArtifactAiSyncSnapshot => ({
      currentArtifactId: state.artifacts.config.currentArtifactId,
      artifactsById: state.artifacts.config.artifactsById,
      aiConfig: state.ai.config,
      sessionArtifactLinks: state.artifactAi.config.sessionArtifactLinks,
    });
    const isSameArtifactAiSyncSnapshot = (
      left: ArtifactAiSyncSnapshot,
      right: ArtifactAiSyncSnapshot,
    ) =>
      left.currentArtifactId === right.currentArtifactId &&
      left.artifactsById === right.artifactsById &&
      left.aiConfig === right.aiConfig &&
      left.sessionArtifactLinks === right.sessionArtifactLinks;

    const cleanupSessionArtifacts = () => {
      const state = get();
      const cleanedLinks = cleanupSessionArtifactLinks({
        sessionArtifactLinks: state.artifactAi.config.sessionArtifactLinks,
        sessions: state.ai.config.sessions,
        artifactIds: Object.keys(state.artifacts.config.artifactsById),
      });

      const linksChanged =
        cleanedLinks.length !==
        state.artifactAi.config.sessionArtifactLinks.length;

      if (!linksChanged) {
        return;
      }

      set((stateToUpdate) =>
        produce(stateToUpdate, (draft: TRoomState) => {
          draft.artifactAi.config.sessionArtifactLinks = cleanedLinks;
        }),
      );
    };

    const syncForkedSessionArtifactOwnership = () => {
      const state = get();
      const sessionIds = new Set(
        state.ai.config.sessions.map((session) => session.id),
      );
      const inheritedEntries = Object.entries(
        state.ai.config.sessionForks ?? {},
      ).flatMap(([targetSessionId, forkOrigin]) => {
        if (!sessionIds.has(targetSessionId)) return [];
        // Seed ownership only once: skip if the fork already has any link.
        if (
          state.artifactAi.config.sessionArtifactLinks.some(
            (link) => link.sessionId === targetSessionId,
          )
        ) {
          return [];
        }
        const seenArtifactIds = new Set<string>();
        return state.artifactAi.config.sessionArtifactLinks
          .filter(
            (link) =>
              link.sessionId === forkOrigin.sourceSessionId &&
              Boolean(state.artifacts.config.artifactsById[link.artifactId]) &&
              !seenArtifactIds.has(link.artifactId),
          )
          .map((link) => {
            seenArtifactIds.add(link.artifactId);
            return {
              targetSessionId,
              artifactId: link.artifactId,
              createdAt: link.createdAt,
            };
          });
      });

      if (inheritedEntries.length === 0) return;

      set((stateToUpdate) =>
        produce(stateToUpdate, (draft: TRoomState) => {
          for (const {
            targetSessionId,
            artifactId,
            createdAt,
          } of inheritedEntries) {
            draft.artifactAi.config.sessionArtifactLinks.push({
              sessionId: targetSessionId,
              artifactId,
              // Preserve source ordering so the fork resolves to the same
              // primary artifact even when several links are inherited.
              createdAt,
              linkType: 'attached',
            });
          }
        }),
      );
    };

    // Keeps the current AI session and artifact in sync:
    // - When artifact changes: switch to the latest session for that artifact
    // - When session changes: switch to the latest artifact for that session
    const syncCurrentArtifactAiSession = () => {
      if (artifactAiSyncing || artifactAiSyncSuspended) return;
      artifactAiSyncing = true;
      try {
        syncForkedSessionArtifactOwnership();
        cleanupSessionArtifacts();
        const state = get();
        const currentArtifactId = state.artifacts.config.currentArtifactId;
        const currentSessionId = state.ai.config.currentSessionId;
        const currentSessionExists = state.ai.config.sessions.some(
          (session) => session.id === currentSessionId,
        );

        // Detect what changed
        const artifactChanged = previousArtifactId !== currentArtifactId;
        const sessionChanged = previousSessionId !== currentSessionId;

        // Note: the previous-artifact/previous-session baseline is NOT updated
        // here. This function mutates currentArtifactId/currentSessionId itself
        // (P1/P2/selectLatestSessionForArtifact), and the re-entrant
        // subscription fire that would observe those mutations is guarded out.
        // Updating the baseline to the *entry* values would therefore leave it
        // stale (pointing at pre-mutation values), so the next genuine change
        // could be misclassified as "unchanged". Instead we reconcile the
        // baseline against the actual post-sync state in `finally`.

        // Get current session's artifact
        const currentSessionArtifactId = currentSessionId
          ? getLatestArtifactIdForAiSession({
              sessionArtifactLinks:
                state.artifactAi.config.sessionArtifactLinks,
              sessionId: currentSessionId,
            })
          : undefined;
        const isCurrentArtifactLinked = Boolean(
          currentSessionId &&
          currentArtifactId &&
          state.artifacts.config.artifactsById[currentArtifactId] &&
          state.artifactAi.config.sessionArtifactLinks.some(
            (link) =>
              link.sessionId === currentSessionId &&
              link.artifactId === currentArtifactId,
          ),
        );

        // A many-to-many session is in sync with any of its linked artifacts,
        // not only the most recently linked one.
        if (
          currentSessionId &&
          currentSessionExists &&
          isCurrentArtifactLinked
        ) {
          return;
        }

        // Priority 1: Session changed -> align the artifact with the new session
        if (sessionChanged) {
          if (currentSessionId && currentSessionExists) {
            if (currentSessionArtifactId) {
              // Only switch artifact if current artifact is not linked to this session
              if (
                !isCurrentArtifactLinked &&
                currentSessionArtifactId !== currentArtifactId &&
                state.artifacts.config.artifactsById[currentSessionArtifactId]
              ) {
                set((stateToUpdate) =>
                  produce(stateToUpdate, (draft: TRoomState) => {
                    draft.artifacts.config.currentArtifactId =
                      currentSessionArtifactId;
                  }),
                );
              }
            } else if (currentArtifactId) {
              // Session has no artifact - clear current artifact
              set((stateToUpdate) =>
                produce(stateToUpdate, (draft: TRoomState) => {
                  draft.artifacts.config.currentArtifactId = undefined;
                }),
              );
            }
            return;
          }

          // The current session was removed (e.g. the owning chat was
          // deleted) and no session is selected. Follow the current artifact
          // to another of its sessions if one remains; otherwise clear the
          // artifact selection so the UI returns to the start screen instead
          // of stranding a selected artifact with no chat.
          if (currentArtifactId) {
            const remainingSessionId = getLatestAiSessionIdForArtifact({
              sessions: state.ai.config.sessions,
              sessionArtifactLinks:
                state.artifactAi.config.sessionArtifactLinks,
              artifactId: currentArtifactId,
            });
            if (remainingSessionId) {
              get().artifactAi.selectLatestSessionForArtifact(
                currentArtifactId,
              );
            } else {
              set((stateToUpdate) =>
                produce(stateToUpdate, (draft: TRoomState) => {
                  draft.artifacts.config.currentArtifactId = undefined;
                }),
              );
            }
          }
          return;
        }

        // Priority 2: Artifact changed -> switch to artifact's latest session
        if (artifactChanged) {
          get().artifactAi.selectLatestSessionForArtifact(currentArtifactId);
          return;
        }

        // Fallback: something is out of sync but we don't know what changed
        // Default to artifact -> session sync
        get().artifactAi.selectLatestSessionForArtifact(currentArtifactId);
      } finally {
        // Reconcile the change-detection baseline against the ACTUAL state
        // left behind by this run (including any mutation this sync made).
        // Keeps `sessionChanged`/`artifactChanged` accurate on the next run.
        const finalState = get();
        previousArtifactId = finalState.artifacts.config.currentArtifactId;
        previousSessionId = finalState.ai.config.currentSessionId;
        artifactAiSyncing = false;
      }
    };

    return {
      artifactAi: {
        config: ArtifactAiConfig.parse(options.config ?? {}),
        setConfig: (config) => {
          const nextConfig = ArtifactAiConfig.parse(config ?? {});
          set((state) =>
            produce(state, (draft: TRoomState) => {
              draft.artifactAi.config = nextConfig;
            }),
          );
        },

        addSessionArtifactLink: (sessionId, artifactId, linkType) => {
          set((state) =>
            produce(state, (draft: TRoomState) => {
              const links = draft.artifactAi.config.sessionArtifactLinks;

              // Check if link already exists
              const existingLink = links.find(
                (link) =>
                  link.sessionId === sessionId &&
                  link.artifactId === artifactId,
              );

              if (!existingLink) {
                links.push({
                  sessionId,
                  artifactId,
                  createdAt: Date.now(),
                  linkType,
                });
              } else if (
                existingLink.linkType === 'attached' &&
                linkType === 'created'
              ) {
                // Creation is durable provenance. Promote an existing link
                // without changing its ordering timestamp; never downgrade it.
                existingLink.linkType = 'created';
              }
            }),
          );
        },

        removeSessionArtifactLink: (sessionId, artifactId) => {
          set((state) =>
            produce(state, (draft: TRoomState) => {
              draft.artifactAi.config.sessionArtifactLinks =
                draft.artifactAi.config.sessionArtifactLinks.filter(
                  (link) =>
                    !(
                      link.sessionId === sessionId &&
                      link.artifactId === artifactId
                    ),
                );
            }),
          );
        },

        removeAllLinksForSession: (sessionId) => {
          set((state) =>
            produce(state, (draft: TRoomState) => {
              draft.artifactAi.config.sessionArtifactLinks =
                draft.artifactAi.config.sessionArtifactLinks.filter(
                  (link) => link.sessionId !== sessionId,
                );
            }),
          );
        },

        removeAllLinksForArtifact: (artifactId) => {
          set((state) =>
            produce(state, (draft: TRoomState) => {
              draft.artifactAi.config.sessionArtifactLinks =
                draft.artifactAi.config.sessionArtifactLinks.filter(
                  (link) => link.artifactId !== artifactId,
                );
            }),
          );
        },

        hasSessionArtifactLink: (sessionId, artifactId) => {
          return get().artifactAi.config.sessionArtifactLinks.some(
            (link) =>
              link.sessionId === sessionId && link.artifactId === artifactId,
          );
        },

        getArtifactIdsForSession: (sessionId) => {
          return getArtifactIdsForAiSession({
            sessionArtifactLinks: get().artifactAi.config.sessionArtifactLinks,
            sessionId,
          });
        },

        getSessionIdsForArtifact: (artifactId) => {
          return get()
            .artifactAi.config.sessionArtifactLinks.filter(
              (link) => link.artifactId === artifactId,
            )
            .sort((a, b) => a.createdAt - b.createdAt)
            .map((link) => link.sessionId);
        },

        getLatestArtifactForSession: (sessionId) => {
          return getLatestArtifactIdForAiSession({
            sessionArtifactLinks: get().artifactAi.config.sessionArtifactLinks,
            sessionId,
          });
        },

        getCreatorSessionForArtifact: (artifactId) => {
          return getCreatorSessionIdForArtifact({
            sessionArtifactLinks: get().artifactAi.config.sessionArtifactLinks,
            artifactId,
          });
        },

        togglePinArtifact: (artifactId) => {
          set((state) =>
            produce(state, (draft) => {
              if (!draft.artifactAi.config.pinnedArtifactIds) {
                draft.artifactAi.config.pinnedArtifactIds = [];
              }
              const index =
                draft.artifactAi.config.pinnedArtifactIds.indexOf(artifactId);
              if (index === -1) {
                draft.artifactAi.config.pinnedArtifactIds.push(artifactId);
              } else {
                draft.artifactAi.config.pinnedArtifactIds.splice(index, 1);
              }
            }),
          );
        },

        isPinnedArtifact: (artifactId) => {
          const pinnedIds = get().artifactAi.config.pinnedArtifactIds ?? [];
          return pinnedIds.includes(artifactId);
        },

        // === INITIALIZATION ===
        initialize: async () => {
          if (!autoSync || unsubscribe) return;
          const initialState = get();
          previousArtifactId = initialState.artifacts.config.currentArtifactId;
          previousSessionId = initialState.ai.config.currentSessionId;
          let previousSnapshot = getArtifactAiSyncSnapshot(initialState);
          unsubscribe = (store as StoreApi<TRoomState>).subscribe((state) => {
            const nextSnapshot = getArtifactAiSyncSnapshot(state);
            if (isSameArtifactAiSyncSnapshot(previousSnapshot, nextSnapshot)) {
              return;
            }
            previousSnapshot = nextSnapshot;
            syncCurrentArtifactAiSession();
          });
        },
        destroy: async () => {
          unsubscribe?.();
          unsubscribe = undefined;
        },
        createArtifactScopedSession: (name, modelProvider, model) => {
          const currentArtifactId = get().artifacts.config.currentArtifactId;
          if (
            !currentArtifactId ||
            !get().artifacts.config.artifactsById[currentArtifactId]
          ) {
            return undefined;
          }

          get().artifactAi.setSyncSuspended(true);
          try {
            get().ai.createSession(name, modelProvider, model);
            const sessionId = get().ai.getCurrentSession()?.id;
            if (!sessionId) return undefined;
            get().artifactAi.addSessionArtifactLink(
              sessionId,
              currentArtifactId,
              'attached',
            );
            return sessionId;
          } finally {
            // Use setSyncSuspended(false) rather than clearing the flag
            // directly so the change-detection baseline is re-anchored to the
            // freshly created session. Otherwise previousSessionId would still
            // point at the pre-creation session and the following
            // selectLatestSessionForArtifact would be misread as a session
            // change and could revert the artifact selection.
            get().artifactAi.setSyncSuspended(false);
            get().artifactAi.selectLatestSessionForArtifact(currentArtifactId);
          }
        },
        selectLatestSessionForArtifact: (artifactId) => {
          const sessionId = getLatestAiSessionIdForArtifact({
            sessions: get().ai.config.sessions,
            sessionArtifactLinks: get().artifactAi.config.sessionArtifactLinks,
            artifactId,
          });
          if (sessionId) {
            if (get().ai.config.currentSessionId !== sessionId) {
              get().ai.switchSession(sessionId);
            }
            return;
          }
          if (get().ai.config.currentSessionId === undefined) {
            return;
          }
          set((state) =>
            produce(state, (draft: TRoomState) => {
              draft.ai.config.currentSessionId = undefined;
            }),
          );
        },
        cleanupSessionArtifacts,
        syncCurrentArtifactAiSession,
        setSyncSuspended: (suspended) => {
          artifactAiSyncSuspended = suspended;
          if (!suspended) {
            // Re-baseline so the next genuine change is measured against the
            // fully-settled selection rather than a stale/undefined baseline.
            const state = get();
            previousArtifactId = state.artifacts.config.currentArtifactId;
            previousSessionId = state.ai.config.currentSessionId;
          }
        },
      },
    };
  });
}
