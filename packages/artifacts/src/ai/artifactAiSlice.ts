/**
 * Artifact-owned AI session slice for apps that compose `@sqlrooms/artifacts`
 * with `@sqlrooms/ai`.
 *
 * The generic AI session schema intentionally does not know about artifacts.
 * This module keeps artifact ownership as a small companion slice keyed by
 * `sessionId -> artifactId`.
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
  ArtifactSessionLink,
  ArtifactSessionLinkSchema,
  type ArtifactSessionLinkType,
} from '../ArtifactsSliceConfig';
import {
  cleanupAiSessionArtifacts,
  getEmptyAiSessionIdForArtifact,
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
export const ArtifactAiConfig = z.object({
  sessionArtifactLinks: z.array(ArtifactSessionLinkSchema).default([]),
});
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

    // === NEW METHODS ===
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

    // === EXISTING METHODS (deprecated) ===
    setSessionArtifact: (sessionId: string, artifactId: string) => void;
    clearSessionArtifact: (sessionId: string) => void;
    getSessionArtifactId: (sessionId: string) => string | undefined;
    setArtifactCreator: (artifactId: string, sessionId: string) => void;
    getArtifactCreatorSessionId: (artifactId: string) => string | undefined;
    getCreatedArtifactIds: (sessionId: string) => string[];
    createArtifactScopedSession: (
      name?: string,
      modelProvider?: string,
      model?: string,
    ) => string | undefined;
    selectLatestSessionForArtifact: (artifactId?: string) => void;
    cleanupSessionArtifacts: () => void;
    syncCurrentArtifactAiSession: () => void;
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
      const cleanedLinks = cleanupAiSessionArtifacts({
        sessionArtifactLinks: state.artifactAi.config.sessionArtifactLinks,
        sessions: state.ai.config.sessions,
        artifactIds: Object.keys(state.artifacts.config.artifactsById),
      }) as ArtifactSessionLink[];

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
        // Check if target already has a link
        if (
          state.artifactAi.config.sessionArtifactLinks.some(
            (link) => link.sessionId === targetSessionId,
          )
        ) {
          return [];
        }
        // Find source artifact from links
        const sourceLink = state.artifactAi.config.sessionArtifactLinks.find(
          (link) => link.sessionId === forkOrigin.sourceSessionId,
        );
        if (!sourceLink) return [];
        if (!state.artifacts.config.artifactsById[sourceLink.artifactId])
          return [];
        return [[targetSessionId, sourceLink.artifactId] as const];
      });

      if (inheritedEntries.length === 0) return;

      set((stateToUpdate) =>
        produce(stateToUpdate, (draft: TRoomState) => {
          for (const [targetSessionId, artifactId] of inheritedEntries) {
            draft.artifactAi.config.sessionArtifactLinks.push({
              sessionId: targetSessionId,
              artifactId,
              createdAt: Date.now(),
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

        // Update previous values
        previousArtifactId = currentArtifactId;
        previousSessionId = currentSessionId;

        // Get current session's artifact
        const currentSessionArtifactId = currentSessionId
          ? getLatestArtifactIdForAiSession({
              sessionArtifactLinks:
                state.artifactAi.config.sessionArtifactLinks,
              sessionId: currentSessionId,
            })
          : undefined;

        // Already in sync - nothing to do
        if (
          currentSessionId &&
          currentSessionExists &&
          currentSessionArtifactId === currentArtifactId
        ) {
          return;
        }

        // Priority 1: Session changed -> switch to session's artifact (or clear if session has no artifact)
        if (sessionChanged && currentSessionId && currentSessionExists) {
          if (currentSessionArtifactId) {
            // Session has artifact - switch to it
            if (
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

        // Priority 2: Artifact changed -> switch to artifact's latest session
        if (artifactChanged) {
          get().artifactAi.selectLatestSessionForArtifact(currentArtifactId);
          return;
        }

        // Fallback: something is out of sync but we don't know what changed
        // Default to artifact -> session sync
        get().artifactAi.selectLatestSessionForArtifact(currentArtifactId);
      } finally {
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

        // === INITIALIZATION ===
        initialize: async () => {
          if (!autoSync || unsubscribe) return;
          let previousSnapshot = getArtifactAiSyncSnapshot(get());
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
        // === DEPRECATED METHODS (for backward compatibility) ===
        setSessionArtifact: (sessionId, artifactId) => {
          console.warn(
            'setSessionArtifact is deprecated, use addSessionArtifactLink',
          );
          get().artifactAi.addSessionArtifactLink(
            sessionId,
            artifactId,
            'attached',
          );
        },
        clearSessionArtifact: (sessionId) => {
          console.warn(
            'clearSessionArtifact is deprecated, use removeAllLinksForSession',
          );
          get().artifactAi.removeAllLinksForSession(sessionId);
        },
        getSessionArtifactId: (sessionId) => {
          console.warn(
            'getSessionArtifactId is deprecated, use getLatestArtifactForSession',
          );
          return get().artifactAi.getLatestArtifactForSession(sessionId);
        },
        setArtifactCreator: (artifactId, sessionId) => {
          console.warn(
            'setArtifactCreator is deprecated, use addSessionArtifactLink',
          );
          get().artifactAi.addSessionArtifactLink(
            sessionId,
            artifactId,
            'created',
          );
        },
        getArtifactCreatorSessionId: (artifactId) => {
          return get().artifactAi.getCreatorSessionForArtifact(artifactId);
        },
        getCreatedArtifactIds: (sessionId) => {
          return get()
            .artifactAi.config.sessionArtifactLinks.filter(
              (link) =>
                link.sessionId === sessionId && link.linkType === 'created',
            )
            .map((link) => link.artifactId);
        },
        createArtifactScopedSession: (name, modelProvider, model) => {
          const currentArtifactId = get().artifacts.config.currentArtifactId;
          if (
            !currentArtifactId ||
            !get().artifacts.config.artifactsById[currentArtifactId]
          ) {
            return undefined;
          }

          const hasExplicitSessionOptions = Boolean(
            name || modelProvider || model,
          );
          if (!hasExplicitSessionOptions) {
            const currentSessionId = get().ai.config.currentSessionId;
            const emptySessionId = getEmptyAiSessionIdForArtifact({
              sessions: get().ai.config.sessions,
              sessionArtifactLinks:
                get().artifactAi.config.sessionArtifactLinks,
              artifactId: currentArtifactId,
              excludeSessionIds: currentSessionId
                ? [currentSessionId]
                : undefined,
            });
            if (emptySessionId) {
              if (currentSessionId !== emptySessionId) {
                get().ai.switchSession(emptySessionId);
              }
              return emptySessionId;
            }
          }

          artifactAiSyncSuspended = true;
          try {
            get().ai.createSession(name, modelProvider, model);
            const sessionId = get().ai.getCurrentSession()?.id;
            if (!sessionId) return undefined;
            get().artifactAi.addSessionArtifactLink(
              sessionId,
              currentArtifactId,
              'created',
            );
            return sessionId;
          } finally {
            artifactAiSyncSuspended = false;
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
      },
    };
  });
}
