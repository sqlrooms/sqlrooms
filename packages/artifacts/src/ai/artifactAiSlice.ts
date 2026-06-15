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
  cleanupAiSessionArtifacts,
  getLatestAiSessionIdForArtifact,
} from './artifactAiSessionHelpers';

/**
 * Persisted configuration for artifact-owned AI sessions.
 *
 * `aiSessionArtifacts` maps AI session ids to artifact ids. Sessions without an
 * entry are unowned and are ignored by artifact-scoped helpers.
 */
export const ArtifactAiConfig = z.object({
  aiSessionArtifacts: z.record(z.string(), z.string()).default({}),
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
    setSessionArtifact: (sessionId: string, artifactId: string) => void;
    clearSessionArtifact: (sessionId: string) => void;
    getSessionArtifactId: (sessionId: string) => string | undefined;
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
  aiSessionArtifacts: ArtifactAiConfig['aiSessionArtifacts'];
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

  return createSlice<ArtifactAiSliceState, TRoomState>((set, get, store) => {
    const getArtifactAiSyncSnapshot = (
      state: TRoomState,
    ): ArtifactAiSyncSnapshot => ({
      currentArtifactId: state.artifacts.config.currentArtifactId,
      artifactsById: state.artifacts.config.artifactsById,
      aiConfig: state.ai.config,
      aiSessionArtifacts: state.artifactAi.config.aiSessionArtifacts,
    });
    const isSameArtifactAiSyncSnapshot = (
      left: ArtifactAiSyncSnapshot,
      right: ArtifactAiSyncSnapshot,
    ) =>
      left.currentArtifactId === right.currentArtifactId &&
      left.artifactsById === right.artifactsById &&
      left.aiConfig === right.aiConfig &&
      left.aiSessionArtifacts === right.aiSessionArtifacts;

    const cleanupSessionArtifacts = () => {
      const state = get();
      const nextAiSessionArtifacts = cleanupAiSessionArtifacts({
        aiSessionArtifacts: state.artifactAi.config.aiSessionArtifacts,
        sessions: state.ai.config.sessions,
        artifactIds: Object.keys(state.artifacts.config.artifactsById),
      });
      if (
        Object.keys(nextAiSessionArtifacts).length ===
        Object.keys(state.artifactAi.config.aiSessionArtifacts).length
      ) {
        return;
      }
      set((stateToUpdate) =>
        produce(stateToUpdate, (draft: TRoomState) => {
          draft.artifactAi.config.aiSessionArtifacts = nextAiSessionArtifacts;
        }),
      );
    };

    const inheritForkedSessionArtifacts = () => {
      const state = get();
      const sessionIds = new Set(
        state.ai.config.sessions.map((session) => session.id),
      );
      const inheritedEntries = Object.entries(
        state.ai.config.sessionForks ?? {},
      ).flatMap(([targetSessionId, forkOrigin]) => {
        if (!sessionIds.has(targetSessionId)) return [];
        if (state.artifactAi.config.aiSessionArtifacts[targetSessionId]) {
          return [];
        }
        const sourceArtifactId =
          state.artifactAi.config.aiSessionArtifacts[
            forkOrigin.sourceSessionId
          ];
        if (!sourceArtifactId) return [];
        if (!state.artifacts.config.artifactsById[sourceArtifactId]) return [];
        return [[targetSessionId, sourceArtifactId] as const];
      });

      if (inheritedEntries.length === 0) return;

      set((stateToUpdate) =>
        produce(stateToUpdate, (draft: TRoomState) => {
          for (const [targetSessionId, artifactId] of inheritedEntries) {
            draft.artifactAi.config.aiSessionArtifacts[targetSessionId] =
              artifactId;
          }
        }),
      );
    };

    // Keeps the current AI session aligned with the current artifact, pruning
    // stale ownership records before selecting the latest session for the
    // active artifact.
    const syncCurrentArtifactAiSession = () => {
      if (artifactAiSyncing || artifactAiSyncSuspended) return;
      artifactAiSyncing = true;
      try {
        inheritForkedSessionArtifacts();
        cleanupSessionArtifacts();
        const state = get();
        const currentArtifactId = state.artifacts.config.currentArtifactId;
        const currentSessionId = state.ai.config.currentSessionId;
        const currentSessionExists = state.ai.config.sessions.some(
          (session) => session.id === currentSessionId,
        );
        const currentSessionArtifactId = currentSessionId
          ? state.artifactAi.config.aiSessionArtifacts[currentSessionId]
          : undefined;

        if (
          currentArtifactId &&
          currentSessionId &&
          currentSessionExists &&
          currentSessionArtifactId === currentArtifactId
        ) {
          return;
        }

        get().artifactAi.selectLatestSessionForArtifact(currentArtifactId);
      } finally {
        artifactAiSyncing = false;
      }
    };

    return {
      artifactAi: {
        config: ArtifactAiConfig.parse(options.config ?? {}),
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
        setSessionArtifact: (sessionId, artifactId) => {
          set((state) =>
            produce(state, (draft: TRoomState) => {
              draft.artifactAi.config.aiSessionArtifacts[sessionId] =
                artifactId;
            }),
          );
        },
        clearSessionArtifact: (sessionId) => {
          set((state) =>
            produce(state, (draft: TRoomState) => {
              delete draft.artifactAi.config.aiSessionArtifacts[sessionId];
            }),
          );
        },
        getSessionArtifactId: (sessionId) =>
          get().artifactAi.config.aiSessionArtifacts[sessionId],
        createArtifactScopedSession: (name, modelProvider, model) => {
          const currentArtifactId = get().artifacts.config.currentArtifactId;
          if (
            !currentArtifactId ||
            !get().artifacts.config.artifactsById[currentArtifactId]
          ) {
            return undefined;
          }

          artifactAiSyncSuspended = true;
          try {
            get().ai.createSession(name, modelProvider, model);
            const sessionId = get().ai.getCurrentSession()?.id;
            if (!sessionId) return undefined;
            get().artifactAi.setSessionArtifact(sessionId, currentArtifactId);
            return sessionId;
          } finally {
            artifactAiSyncSuspended = false;
            get().artifactAi.selectLatestSessionForArtifact(currentArtifactId);
          }
        },
        selectLatestSessionForArtifact: (artifactId) => {
          const sessionId = getLatestAiSessionIdForArtifact({
            sessions: get().ai.config.sessions,
            aiSessionArtifacts: get().artifactAi.config.aiSessionArtifacts,
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
