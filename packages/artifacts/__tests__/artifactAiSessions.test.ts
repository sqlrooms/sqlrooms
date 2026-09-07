import {ChatSessionSchema} from '@sqlrooms/ai-config';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {createStore} from 'zustand';
import {
  ArtifactSessionLinkSchema,
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactsSliceState,
} from '../src';
import {
  cleanupSessionArtifactLinks,
  ArtifactAiConfigSchema,
  createArtifactAiSlice,
  findAiSessionForArtifactWithContextItem,
  getAiSessionGroupsByArtifact,
  getAiSessionIdsForArtifact,
  getEmptyAiSessionIdForArtifact,
  getLatestAiSessionIdForArtifact,
  getOwningArtifactRunContextItems,
  getRunningAiSessionCountsByArtifact,
  isAiSessionVisibleForArtifact,
  type ArtifactAiSessionFilterOptions,
  type ArtifactAiSessionGroupsOptions,
  type ArtifactAiSliceState,
  type CleanupSessionArtifactLinksOptions,
} from '../src/ai';

type TestRoomState = BaseRoomStoreState &
  ArtifactsSliceState &
  ArtifactAiSliceState & {
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

function createSession(
  id: string,
  lastOpenedAt: number,
  isRunning = false,
): ChatSessionSchema {
  return {
    id,
    name: id,
    modelProvider: 'openai',
    model: 'gpt-4.1',
    createdAt: new Date(0),
    uiMessages: [],
    messagesRevision: 0,
    prompt: '',
    isRunning,
    lastOpenedAt,
  };
}

function createTestStore({autoSync = false}: {autoSync?: boolean} = {}) {
  const artifactTypes = defineArtifactTypes({
    dashboard: {
      label: 'Dashboard',
      defaultTitle: 'Dashboard',
    },
    'block-document': {
      label: 'Block Document',
      defaultTitle: 'Block Document',
    },
  });

  const store = createStore<TestRoomState>()((set, get, storeApi) => ({
    ...createBaseRoomSlice()(set, get, storeApi),
    ...createArtifactsSlice({artifactTypes})(set, get, storeApi),
    ai: {
      config: {
        sessions: [],
        currentSessionId: undefined,
      },
      createSession: (name, modelProvider, model) => {
        set((state) =>
          produce(state, (draft: TestRoomState) => {
            const id = `session-${draft.ai.config.sessions.length + 1}`;
            draft.ai.config.sessions.unshift({
              ...createSession(id, draft.ai.config.sessions.length + 1),
              name: name ?? id,
              modelProvider: modelProvider ?? 'openai',
              model: model ?? 'gpt-4.1',
            });
            draft.ai.config.currentSessionId = id;
          }),
        );
      },
      switchSession: (sessionId) => {
        set((state) =>
          produce(state, (draft: TestRoomState) => {
            draft.ai.config.currentSessionId = sessionId;
            const session = draft.ai.config.sessions.find(
              (candidate) => candidate.id === sessionId,
            );
            if (session) {
              session.lastOpenedAt = 100;
            }
          }),
        );
      },
      getCurrentSession: () => {
        const state = get();
        return state.ai.config.sessions.find(
          (session) => session.id === state.ai.config.currentSessionId,
        );
      },
    },
    ...createArtifactAiSlice({autoSync})(set, get, storeApi),
  }));

  store.getState().artifacts.ensureArtifact('artifact-a', {
    type: 'dashboard',
    title: 'Dashboard A',
  });
  store.getState().artifacts.ensureArtifact('artifact-b', {
    type: 'block-document',
    title: 'Block Document B',
  });

  return store;
}

describe('artifact AI session helpers', () => {
  const sessions = [
    createSession('session-a-old', 1),
    createSession('session-a-new', 3, true),
    createSession('session-b', 2, true),
    createSession('session-unowned', 4, true),
  ];
  const sessionArtifactLinks = [
    {
      sessionId: 'session-a-old',
      artifactId: 'artifact-a',
      linkedAt: 1000,
    },
    {
      sessionId: 'session-a-new',
      artifactId: 'artifact-a',
      linkedAt: 3000,
    },
    {
      sessionId: 'session-b',
      artifactId: 'artifact-b',
      linkedAt: 2000,
    },
  ];

  it('exposes link-aware option types for public helpers', () => {
    const filterOptions: ArtifactAiSessionFilterOptions = {
      sessionArtifactLinks,
      sessionId: 'session-a-new',
      artifactId: 'artifact-a',
    };
    const groupsOptions: ArtifactAiSessionGroupsOptions = {
      sessions,
      sessionArtifactLinks,
    };
    const cleanupOptions: CleanupSessionArtifactLinksOptions = {
      sessions,
      sessionArtifactLinks,
      artifactIds: ['artifact-a', 'artifact-b'],
    };

    expect(isAiSessionVisibleForArtifact(filterOptions)).toBe(true);
    expect(getAiSessionGroupsByArtifact(groupsOptions)).toEqual({
      'artifact-a': ['session-a-old', 'session-a-new'],
      'artifact-b': ['session-b'],
    });
    expect(cleanupSessionArtifactLinks(cleanupOptions)).toEqual(
      sessionArtifactLinks,
    );
  });

  it('filters and selects only explicitly artifact-owned sessions', () => {
    expect(
      isAiSessionVisibleForArtifact({
        sessionArtifactLinks,
        sessionId: 'session-a-new',
        artifactId: 'artifact-a',
      }),
    ).toBe(true);
    expect(
      isAiSessionVisibleForArtifact({
        sessionArtifactLinks,
        sessionId: 'session-unowned',
        artifactId: 'artifact-a',
      }),
    ).toBe(false);
    expect(
      getAiSessionIdsForArtifact({
        sessions,
        sessionArtifactLinks,
        artifactId: 'artifact-a',
      }),
    ).toEqual(['session-a-old', 'session-a-new']);
    expect(
      getLatestAiSessionIdForArtifact({
        sessions,
        sessionArtifactLinks,
        artifactId: 'artifact-a',
      }),
    ).toBe('session-a-new');
  });

  it('selects the latest empty owned session for an artifact', () => {
    expect(
      getEmptyAiSessionIdForArtifact({
        sessions: [
          createSession('empty-older', 1),
          {...createSession('non-empty-newer', 3), prompt: 'hello'},
          createSession('empty-newer', 2),
          createSession('running-empty', 4, true),
        ],
        sessionArtifactLinks: [
          {
            sessionId: 'empty-older',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
          {
            sessionId: 'non-empty-newer',
            artifactId: 'artifact-a',
            linkedAt: 3000,
          },
          {
            sessionId: 'empty-newer',
            artifactId: 'artifact-a',
            linkedAt: 2000,
          },
          {
            sessionId: 'running-empty',
            artifactId: 'artifact-a',
            linkedAt: 4000,
          },
        ],
        artifactId: 'artifact-a',
      }),
    ).toBe('empty-newer');
  });

  it('finds the latest owned session with a matching draft context item', () => {
    expect(
      findAiSessionForArtifactWithContextItem({
        sessions: [
          {
            ...createSession('older-draft-match', 1),
            draftContextItemIds: ['block:document:block-a'],
          },
          {
            ...createSession('newer-draft-match', 2),
            draftContextItemIds: ['block:document:block-a'],
          },
          {
            ...createSession('other-artifact-match', 3),
            draftContextItemIds: ['block:document:block-a'],
          },
        ],
        sessionArtifactLinks: [
          {
            sessionId: 'older-draft-match',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
          {
            sessionId: 'newer-draft-match',
            artifactId: 'artifact-a',
            linkedAt: 2000,
          },
          {
            sessionId: 'other-artifact-match',
            artifactId: 'artifact-b',
            linkedAt: 3000,
          },
        ],
        artifactId: 'artifact-a',
        contextItemId: 'block:document:block-a',
      }),
    ).toBe('newer-draft-match');
  });

  it('finds an owned session with a matching run context item', () => {
    expect(
      findAiSessionForArtifactWithContextItem({
        sessions: [
          {
            ...createSession('run-match', 1),
            runContext: {
              items: [
                {
                  kind: 'block',
                  id: 'block:document:block-a',
                  title: 'Chart',
                },
              ],
              capturedAt: 1,
            },
          },
        ],
        sessionArtifactLinks: [
          {
            sessionId: 'run-match',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
        ],
        artifactId: 'artifact-a',
        contextItemId: 'block:document:block-a',
      }),
    ).toBe('run-match');
  });

  it('skips running context matches unless requested', () => {
    const matchingRunningSession = {
      ...createSession('running-match', 3, true),
      draftContextItemIds: ['block:document:block-a'],
    };
    const testLinks = [
      {
        sessionId: 'running-match',
        artifactId: 'artifact-a',
        linkedAt: 3000,
      },
    ];

    expect(
      findAiSessionForArtifactWithContextItem({
        sessions: [matchingRunningSession],
        sessionArtifactLinks: testLinks,
        artifactId: 'artifact-a',
        contextItemId: 'block:document:block-a',
      }),
    ).toBeUndefined();

    expect(
      findAiSessionForArtifactWithContextItem({
        sessions: [matchingRunningSession],
        sessionArtifactLinks: testLinks,
        artifactId: 'artifact-a',
        contextItemId: 'block:document:block-a',
        includeRunning: true,
      }),
    ).toBe('running-match');
  });

  it('returns undefined when no owned session has the context item', () => {
    expect(
      findAiSessionForArtifactWithContextItem({
        sessions: [
          {
            ...createSession('no-match', 1),
            draftContextItemIds: ['block:document:block-b'],
          },
        ],
        sessionArtifactLinks: [
          {
            sessionId: 'no-match',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
        ],
        artifactId: 'artifact-a',
        contextItemId: 'block:document:block-a',
      }),
    ).toBeUndefined();
  });

  it('can exclude empty owned sessions when selecting an artifact draft', () => {
    expect(
      getEmptyAiSessionIdForArtifact({
        sessions: [
          createSession('empty-older', 1),
          createSession('empty-newer', 2),
        ],
        sessionArtifactLinks: [
          {
            sessionId: 'empty-older',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
          {
            sessionId: 'empty-newer',
            artifactId: 'artifact-a',
            linkedAt: 2000,
          },
        ],
        artifactId: 'artifact-a',
        excludeSessionIds: ['empty-newer'],
      }),
    ).toBe('empty-older');
  });

  it('does not select session summaries that lack message fields as empty', () => {
    expect(
      getEmptyAiSessionIdForArtifact({
        sessions: [
          {
            id: 'summary-only',
            isRunning: false,
            lastOpenedAt: 1,
          } as any,
        ],
        sessionArtifactLinks: [
          {
            sessionId: 'summary-only',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
        ],
        artifactId: 'artifact-a',
      }),
    ).toBeUndefined();
  });

  it('groups and counts running sessions by artifact', () => {
    expect(
      getAiSessionGroupsByArtifact({sessions, sessionArtifactLinks}),
    ).toEqual({
      'artifact-a': ['session-a-old', 'session-a-new'],
      'artifact-b': ['session-b'],
    });
    expect(
      getRunningAiSessionCountsByArtifact({sessions, sessionArtifactLinks}),
    ).toEqual({
      'artifact-a': 1,
      'artifact-b': 1,
    });
  });

  it('drops links to sessions that no longer exist when grouping', () => {
    expect(
      getAiSessionGroupsByArtifact({
        sessions,
        sessionArtifactLinks: [
          ...sessionArtifactLinks,
          {
            sessionId: 'deleted-session',
            artifactId: 'artifact-a',
            linkedAt: 5000,
          },
        ],
      }),
    ).toEqual({
      'artifact-a': ['session-a-old', 'session-a-new'],
      'artifact-b': ['session-b'],
    });
  });

  it('removes mappings for deleted sessions and artifacts', () => {
    expect(
      cleanupSessionArtifactLinks({
        sessionArtifactLinks: [
          ...sessionArtifactLinks,
          {
            sessionId: 'deleted-session',
            artifactId: 'artifact-a',
            linkedAt: 5000,
          },
          {
            sessionId: 'session-a-new',
            artifactId: 'deleted-artifact',
            linkedAt: 6000,
          },
        ],
        sessions,
        artifactIds: ['artifact-a', 'artifact-b'],
      }),
    ).toEqual([
      {
        sessionId: 'session-a-old',
        artifactId: 'artifact-a',
        linkedAt: 1000,
      },
      {
        sessionId: 'session-a-new',
        artifactId: 'artifact-a',
        linkedAt: 3000,
      },
      {
        sessionId: 'session-b',
        artifactId: 'artifact-b',
        linkedAt: 2000,
      },
    ]);
  });

  it('prepends the owning artifact to run context items', () => {
    expect(
      getOwningArtifactRunContextItems({
        sessionId: 'session-a-new',
        sessionArtifactLinks,
        artifactsById: {
          'artifact-a': {
            id: 'artifact-a',
            type: 'dashboard',
            title: 'Dashboard A',
          },
          'artifact-b': {
            id: 'artifact-b',
            type: 'block-document',
            title: 'Block Document B',
          },
        },
        extraItems: [
          {
            kind: 'artifact',
            id: 'artifact-a',
            type: 'dashboard',
            title: 'Dashboard A',
          },
          {
            kind: 'artifact',
            id: 'artifact-b',
            type: 'block-document',
            title: 'Block Document B',
          },
        ],
      }).map((item) => item.id),
    ).toEqual(['artifact-a', 'artifact-b']);
  });

  it('prefers the target artifact over the most recently linked one', () => {
    // session-a-new is linked to artifact-a (linkedAt 3000). Add a newer link
    // to artifact-b so the "latest" artifact is artifact-b.
    const multiLinks = [
      ...sessionArtifactLinks,
      {
        sessionId: 'session-a-new',
        artifactId: 'artifact-b',
        linkedAt: 4000,
      },
    ];
    const artifactsById = {
      'artifact-a': {
        id: 'artifact-a',
        type: 'dashboard',
        title: 'Dashboard A',
      },
      'artifact-b': {
        id: 'artifact-b',
        type: 'block-document',
        title: 'Block Document B',
      },
    };

    // Without a preferred artifact the latest link (artifact-b) wins.
    expect(
      getOwningArtifactRunContextItems({
        sessionId: 'session-a-new',
        sessionArtifactLinks: multiLinks,
        artifactsById,
      }).map((item) => item.id),
    ).toEqual(['artifact-b']);

    // Asking from artifact-a should direct the run at artifact-a even though it
    // is not the most recently linked artifact.
    expect(
      getOwningArtifactRunContextItems({
        sessionId: 'session-a-new',
        sessionArtifactLinks: multiLinks,
        artifactsById,
        preferredArtifactId: 'artifact-a',
      }).map((item) => item.id),
    ).toEqual(['artifact-a']);
  });

  it('ignores a preferred artifact not linked to the session', () => {
    const multiLinks = [
      ...sessionArtifactLinks,
      {
        sessionId: 'session-a-new',
        artifactId: 'artifact-b',
        linkedAt: 4000,
      },
    ];
    const artifactsById = {
      'artifact-a': {id: 'artifact-a', type: 'dashboard', title: 'Dashboard A'},
      'artifact-b': {
        id: 'artifact-b',
        type: 'block-document',
        title: 'Block Document B',
      },
    };

    // 'artifact-b' is linked, but 'unlinked-artifact' is not part of the
    // session, so it falls back to the latest linked artifact (artifact-b).
    expect(
      getOwningArtifactRunContextItems({
        sessionId: 'session-a-new',
        sessionArtifactLinks: multiLinks,
        artifactsById,
        preferredArtifactId: 'unlinked-artifact',
      }).map((item) => item.id),
    ).toEqual(['artifact-b']);
  });
});

describe('createArtifactAiSlice', () => {
  it('creates artifact-scoped sessions for the current artifact', () => {
    const store = createTestStore();

    store.getState().artifacts.setCurrentArtifact('artifact-a');
    const sessionId = store.getState().artifactAi.createArtifactScopedSession();

    expect(sessionId).toBe('session-1');
    expect(
      store.getState().artifactAi.getLatestArtifactForSession('session-1'),
    ).toBe('artifact-a');
    expect(store.getState().ai.config.currentSessionId).toBe('session-1');
    expect(
      store
        .getState()
        .artifactAi.hasSessionArtifactLink('session-1', 'artifact-a'),
    ).toBe(true);
  });

  it('creates a new artifact-scoped session instead of reusing the current empty session', () => {
    const store = createTestStore();
    store.getState().artifacts.setCurrentArtifact('artifact-a');
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [createSession('current-empty', 1)];
        draft.ai.config.currentSessionId = 'current-empty';
        draft.artifactAi.config.sessionArtifactLinks = [
          {
            sessionId: 'current-empty',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
        ];
      }),
    );

    const sessionId = store.getState().artifactAi.createArtifactScopedSession();

    expect(sessionId).toBe('session-2');
    expect(store.getState().ai.config.currentSessionId).toBe('session-2');
    expect(store.getState().ai.config.sessions).toHaveLength(2);
    expect(
      store.getState().artifactAi.getLatestArtifactForSession('session-2'),
    ).toBe('artifact-a');
  });

  it('creates a new artifact-scoped session when explicit session options are provided', () => {
    const store = createTestStore();
    store.getState().artifacts.setCurrentArtifact('artifact-a');
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [createSession('empty-session', 1)];
        draft.artifactAi.config.sessionArtifactLinks = [
          {
            sessionId: 'empty-session',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
        ];
      }),
    );

    const sessionId = store
      .getState()
      .artifactAi.createArtifactScopedSession(
        'Named draft',
        'anthropic',
        'claude-sonnet-4',
      );

    expect(sessionId).toBe('session-2');
    const session = store
      .getState()
      .ai.config.sessions.find((candidate) => candidate.id === sessionId);
    expect(session).toMatchObject({
      name: 'Named draft',
      modelProvider: 'anthropic',
      model: 'claude-sonnet-4',
    });
    expect(
      store.getState().artifactAi.getLatestArtifactForSession('session-2'),
    ).toBe('artifact-a');
  });

  it('does not revert the artifact after creating a scoped session then selecting another artifact', () => {
    const store = createTestStore();

    // Select artifact A and start an artifact-scoped chat on it. This creates
    // a new session and makes it current under a suspended sync.
    store.getState().artifacts.setCurrentArtifact('artifact-a');
    const sessionId = store.getState().artifactAi.createArtifactScopedSession();
    expect(sessionId).toBe('session-1');
    expect(store.getState().ai.config.currentSessionId).toBe('session-1');

    // User now selects a different artifact B. The subscription-driven sync
    // must treat this as an artifact change, not a phantom session change.
    store.getState().artifacts.setCurrentArtifact('artifact-b');
    store.getState().artifactAi.syncCurrentArtifactAiSession();

    // Bug: with a stale baseline the sync misreads session-1 as "just changed"
    // (Priority 1) and reverts the selection back to artifact-a.
    expect(store.getState().artifacts.config.currentArtifactId).toBe(
      'artifact-b',
    );
  });

  it('anchors auto-sync to the selection that exists at initialization', async () => {
    const store = createTestStore({autoSync: true});
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.artifacts.config.currentArtifactId = 'artifact-a';
        draft.ai.config.sessions = [createSession('session-a', 1)];
        draft.ai.config.currentSessionId = 'session-a';
        draft.artifactAi.config.sessionArtifactLinks = [
          {
            sessionId: 'session-a',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
        ];
      }),
    );
    await store.getState().artifactAi.initialize();

    store.getState().artifacts.setCurrentArtifact('artifact-b');

    expect(store.getState().artifacts.config.currentArtifactId).toBe(
      'artifact-b',
    );
    expect(store.getState().ai.config.currentSessionId).toBeUndefined();
    await store.getState().artifactAi.destroy();
  });

  it('keeps an unlinked chat session selected when sync runs without a current artifact', async () => {
    const store = createTestStore({autoSync: true});
    await store.getState().artifactAi.initialize();

    // Welcome-screen / "New Chat" path: create a chat that is not linked to
    // any artifact and make it current. Activation is a side effect of
    // createSession setting currentSessionId.
    store.getState().ai.createSession('Chat 1');
    expect(store.getState().ai.config.currentSessionId).toBe('session-1');

    // A later, unrelated ai.config change (submitting a prompt calls
    // setPrompt right after creation; the sidebar produces similar updates)
    // triggers another sync pass. That pass sees neither a session nor an
    // artifact change and falls through to the reconciliation fallback.
    // Before the fix the fallback called selectLatestSessionForArtifact(undefined),
    // which cleared currentSessionId and dropped the UI back to the start
    // screen (so the created chat "never activated" and startAnalysisWhenReady
    // timed out waiting for its chat provider to mount).
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        const session = draft.ai.config.sessions.find(
          (candidate) => candidate.id === 'session-1',
        );
        if (session) {
          session.prompt = 'How many pizza places are in San Francisco?';
        }
      }),
    );

    expect(store.getState().ai.config.currentSessionId).toBe('session-1');
    await store.getState().artifactAi.destroy();
  });

  it('inherits artifact ownership for forked sessions', () => {
    const store = createTestStore();
    store.getState().artifacts.setCurrentArtifact('artifact-a');
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [
          createSession('target-session', 2),
          createSession('source-session', 1),
        ];
        draft.ai.config.currentSessionId = 'target-session';
        draft.ai.config.sessionForks = {
          'target-session': {
            sourceSessionId: 'source-session',
          },
        };
        draft.artifactAi.config.sessionArtifactLinks = [
          {
            sessionId: 'source-session',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
        ];
      }),
    );

    store.getState().artifactAi.syncCurrentArtifactAiSession();

    expect(
      store.getState().artifactAi.getLatestArtifactForSession('target-session'),
    ).toBe('artifact-a');
    expect(store.getState().ai.config.currentSessionId).toBe('target-session');
  });

  it('inherits all artifacts for a fork of a multi-artifact session', () => {
    const store = createTestStore();
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [
          createSession('target-session', 2),
          createSession('source-session', 1),
        ];
        draft.ai.config.currentSessionId = 'target-session';
        draft.ai.config.sessionForks = {
          'target-session': {
            sourceSessionId: 'source-session',
          },
        };
        // The source session is linked to two different artifacts.
        draft.artifactAi.config.sessionArtifactLinks = [
          {
            sessionId: 'source-session',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
          {
            sessionId: 'source-session',
            artifactId: 'artifact-b',
            linkedAt: 2000,
          },
        ];
      }),
    );

    store.getState().artifactAi.syncCurrentArtifactAiSession();

    // The fork must inherit BOTH artifacts, not just the first link.
    expect(
      store.getState().artifactAi.getArtifactIdsForSession('target-session'),
    ).toEqual(['artifact-a', 'artifact-b']);
    expect(
      store.getState().artifactAi.getLatestArtifactForSession('target-session'),
    ).toBe('artifact-b');
    expect(
      store
        .getState()
        .artifactAi.config.sessionArtifactLinks.filter(
          (link) => link.sessionId === 'target-session',
        )
        .map((link) => link.linkedAt),
    ).toEqual([1000, 2000]);
  });

  it('keeps a session selected while the current artifact is any of its links', () => {
    const store = createTestStore();
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.artifacts.config.currentArtifactId = 'artifact-a';
        draft.ai.config.sessions = [
          createSession('current-session', 1),
          createSession('other-session', 2),
        ];
        draft.ai.config.currentSessionId = 'current-session';
        draft.artifactAi.config.sessionArtifactLinks = [
          {
            sessionId: 'current-session',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
          {
            sessionId: 'current-session',
            artifactId: 'artifact-b',
            linkedAt: 2000,
          },
          {
            sessionId: 'other-session',
            artifactId: 'artifact-a',
            linkedAt: 3000,
          },
        ];
      }),
    );

    store.getState().artifactAi.syncCurrentArtifactAiSession();
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [...draft.ai.config.sessions];
      }),
    );
    store.getState().artifactAi.syncCurrentArtifactAiSession();

    expect(store.getState().ai.config.currentSessionId).toBe('current-session');
    expect(store.getState().artifacts.config.currentArtifactId).toBe(
      'artifact-a',
    );
  });

  it('selects the latest mapped session and ignores unowned sessions', () => {
    const store = createTestStore();
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [
          createSession('unowned-newer', 10),
          createSession('owned-older', 1),
          createSession('owned-newer', 5),
        ];
        draft.ai.config.currentSessionId = 'unowned-newer';
        draft.artifactAi.config.sessionArtifactLinks = [
          {
            sessionId: 'owned-older',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
          {
            sessionId: 'owned-newer',
            artifactId: 'artifact-a',
            linkedAt: 5000,
          },
        ];
      }),
    );

    store.getState().artifactAi.selectLatestSessionForArtifact('artifact-a');

    expect(store.getState().ai.config.currentSessionId).toBe('owned-newer');
  });

  it('clears the current artifact when its owning chat is deleted', () => {
    const store = createTestStore();

    // Artifact-a is selected together with its only owning session.
    store.getState().artifacts.setCurrentArtifact('artifact-a');
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [createSession('session-1', 1)];
        draft.ai.config.currentSessionId = 'session-1';
        draft.artifactAi.config.sessionArtifactLinks = [
          {
            sessionId: 'session-1',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
        ];
      }),
    );

    // Baseline the change-detection against the aligned state.
    store.getState().artifactAi.syncCurrentArtifactAiSession();
    expect(store.getState().artifacts.config.currentArtifactId).toBe(
      'artifact-a',
    );

    // Delete the only chat, mirroring ai.deleteSession removing the last
    // session: the session disappears and currentSessionId becomes undefined.
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [];
        draft.ai.config.currentSessionId = undefined;
      }),
    );

    store.getState().artifactAi.syncCurrentArtifactAiSession();

    expect(store.getState().artifacts.config.currentArtifactId).toBeUndefined();
    expect(store.getState().ai.config.currentSessionId).toBeUndefined();
  });

  it('follows the artifact to a remaining session when the current session is removed', () => {
    const store = createTestStore();

    store.getState().artifacts.setCurrentArtifact('artifact-a');
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [
          createSession('session-current', 2),
          createSession('session-other', 1),
        ];
        draft.ai.config.currentSessionId = 'session-current';
        draft.artifactAi.config.sessionArtifactLinks = [
          {
            sessionId: 'session-current',
            artifactId: 'artifact-a',
            linkedAt: 2000,
          },
          {
            sessionId: 'session-other',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
        ];
      }),
    );

    store.getState().artifactAi.syncCurrentArtifactAiSession();
    expect(store.getState().artifacts.config.currentArtifactId).toBe(
      'artifact-a',
    );

    // The current session is removed while the artifact still has another
    // session. The artifact stays selected and we follow it to that session.
    // A newer, unlinked session remains too: sync must follow the artifact's
    // linked session, not simply pick the most recent remaining session.
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [
          createSession('session-unowned', 3),
          createSession('session-other', 1),
        ];
        draft.ai.config.currentSessionId = undefined;
      }),
    );

    store.getState().artifactAi.syncCurrentArtifactAiSession();

    expect(store.getState().artifacts.config.currentArtifactId).toBe(
      'artifact-a',
    );
    expect(store.getState().ai.config.currentSessionId).toBe('session-other');
  });

  it('ignores a global fallback session when deleting the active artifact chat', () => {
    const store = createTestStore();

    store.getState().artifacts.setCurrentArtifact('artifact-a');
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [
          createSession('session-current', 3),
          createSession('session-b', 2),
          createSession('session-a-other', 1),
        ];
        draft.ai.config.currentSessionId = 'session-current';
        draft.artifactAi.config.sessionArtifactLinks = [
          {
            sessionId: 'session-current',
            artifactId: 'artifact-a',
            linkedAt: 3000,
          },
          {
            sessionId: 'session-b',
            artifactId: 'artifact-b',
            linkedAt: 2000,
          },
          {
            sessionId: 'session-a-other',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
        ];
      }),
    );

    store.getState().artifactAi.syncCurrentArtifactAiSession();

    // Mirror ai.deleteSession(): it removes the active session and selects
    // the first remaining global session, which belongs to artifact B here.
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [
          createSession('session-b', 2),
          createSession('session-a-other', 1),
        ];
        draft.ai.config.currentSessionId = 'session-b';
      }),
    );

    store.getState().artifactAi.syncCurrentArtifactAiSession();

    expect(store.getState().artifacts.config.currentArtifactId).toBe(
      'artifact-a',
    );
    expect(store.getState().ai.config.currentSessionId).toBe('session-a-other');
  });

  it('cleans up stale mappings', () => {
    const store = createTestStore();
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        // Both session-a and session-b exist, so the deleted-artifact link below
        // can only be removed because its artifact is gone (isolating artifact
        // cleanup from session cleanup, which the deleted-session link covers).
        draft.ai.config.sessions = [
          createSession('session-a', 1),
          createSession('session-b', 2),
        ];
        draft.artifactAi.config.sessionArtifactLinks = [
          {
            sessionId: 'session-a',
            artifactId: 'artifact-a',
            linkedAt: 1000,
          },
          {
            sessionId: 'deleted-session',
            artifactId: 'artifact-a',
            linkedAt: 2000,
          },
          {
            sessionId: 'session-b',
            artifactId: 'deleted-artifact',
            linkedAt: 3000,
          },
        ];
      }),
    );

    store.getState().artifactAi.cleanupSessionArtifacts();

    expect(store.getState().artifactAi.config.sessionArtifactLinks).toEqual([
      {
        sessionId: 'session-a',
        artifactId: 'artifact-a',
        linkedAt: 1000,
      },
    ]);
  });
});

describe('artifactAi link mutations', () => {
  it('adds, queries, and removes session-artifact links', () => {
    const store = createTestStore();
    const {artifactAi} = store.getState();

    expect(artifactAi.hasSessionArtifactLink('s1', 'artifact-a')).toBe(false);

    artifactAi.addSessionArtifactLink('s1', 'artifact-a');
    artifactAi.addSessionArtifactLink('s1', 'artifact-b');
    artifactAi.addSessionArtifactLink('s2', 'artifact-a');

    expect(
      store.getState().artifactAi.hasSessionArtifactLink('s1', 'artifact-a'),
    ).toBe(true);
    expect(store.getState().artifactAi.getArtifactIdsForSession('s1')).toEqual([
      'artifact-a',
      'artifact-b',
    ]);
    expect(
      store.getState().artifactAi.getSessionIdsForArtifact('artifact-a'),
    ).toEqual(['s1', 's2']);

    store.getState().artifactAi.removeSessionArtifactLink('s1', 'artifact-a');
    expect(
      store.getState().artifactAi.hasSessionArtifactLink('s1', 'artifact-a'),
    ).toBe(false);
    expect(store.getState().artifactAi.getArtifactIdsForSession('s1')).toEqual([
      'artifact-b',
    ]);
  });

  it('does not duplicate an existing link', () => {
    const store = createTestStore();
    store.getState().artifactAi.addSessionArtifactLink('s1', 'artifact-a');
    store.getState().artifactAi.addSessionArtifactLink('s1', 'artifact-a');

    expect(
      store
        .getState()
        .artifactAi.config.sessionArtifactLinks.filter(
          (link) => link.sessionId === 's1' && link.artifactId === 'artifact-a',
        ),
    ).toHaveLength(1);
  });

  it('removes all links for a session', () => {
    const store = createTestStore();
    const {artifactAi} = store.getState();
    artifactAi.addSessionArtifactLink('s1', 'artifact-a');
    artifactAi.addSessionArtifactLink('s1', 'artifact-b');
    artifactAi.addSessionArtifactLink('s2', 'artifact-a');

    store.getState().artifactAi.removeAllLinksForSession('s1');

    expect(store.getState().artifactAi.getArtifactIdsForSession('s1')).toEqual(
      [],
    );
    expect(
      store.getState().artifactAi.getSessionIdsForArtifact('artifact-a'),
    ).toEqual(['s2']);
  });

  it('removes all links for an artifact', () => {
    const store = createTestStore();
    const {artifactAi} = store.getState();
    artifactAi.addSessionArtifactLink('s1', 'artifact-a');
    artifactAi.addSessionArtifactLink('s2', 'artifact-a');
    artifactAi.addSessionArtifactLink('s1', 'artifact-b');

    store.getState().artifactAi.removeAllLinksForArtifact('artifact-a');

    expect(
      store.getState().artifactAi.getSessionIdsForArtifact('artifact-a'),
    ).toEqual([]);
    expect(store.getState().artifactAi.getArtifactIdsForSession('s1')).toEqual([
      'artifact-b',
    ]);
  });
});

describe('ArtifactAiConfigSchema', () => {
  it('defaults to an empty link list', () => {
    expect(ArtifactAiConfigSchema.parse({})).toEqual({
      sessionArtifactLinks: [],
    });
  });

  it('accepts the session-artifact link format', () => {
    expect(
      ArtifactAiConfigSchema.parse({
        sessionArtifactLinks: [
          {
            sessionId: 'session-2',
            artifactId: 'artifact-b',
            linkedAt: 2000,
          },
        ],
      }).sessionArtifactLinks,
    ).toEqual([
      {
        sessionId: 'session-2',
        artifactId: 'artifact-b',
        linkedAt: 2000,
      },
    ]);
  });

  it('rejects fields no longer owned by the artifact AI slice', () => {
    expect(
      ArtifactAiConfigSchema.safeParse({
        aiSessionArtifacts: {'session-1': 'artifact-a'},
      }).success,
    ).toBe(false);
    expect(
      ArtifactAiConfigSchema.safeParse({
        artifactCreators: {'artifact-a': 'session-1'},
      }).success,
    ).toBe(false);
    expect(
      ArtifactAiConfigSchema.safeParse({pinnedArtifactIds: ['artifact-a']})
        .success,
    ).toBe(false);
  });
});

describe('ArtifactSessionLink types', () => {
  it('validates an association', () => {
    const link = {
      sessionId: 'session-1',
      artifactId: 'artifact-1',
      linkedAt: Date.now(),
    };

    const result = ArtifactSessionLinkSchema.safeParse(link);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(link);
    }
  });

  it('rejects legacy provenance metadata', () => {
    const link = {
      sessionId: 'session-1',
      artifactId: 'artifact-1',
      linkedAt: Date.now(),
      linkType: 'created',
    };

    const result = ArtifactSessionLinkSchema.safeParse(link);
    expect(result.success).toBe(false);
  });

  it.each([-1, 1.5])('rejects invalid linkedAt value %s', (linkedAt) => {
    const result = ArtifactSessionLinkSchema.safeParse({
      sessionId: 'session-1',
      artifactId: 'artifact-1',
      linkedAt,
    });

    expect(result.success).toBe(false);
  });

  it('should reject a link missing each required field independently', () => {
    const validLink = {
      sessionId: 'session-1',
      artifactId: 'artifact-1',
      linkedAt: 1000,
    };

    for (const field of ['sessionId', 'artifactId', 'linkedAt'] as const) {
      const link = {...validLink, [field]: undefined};
      const result = ArtifactSessionLinkSchema.safeParse(link);
      expect(result.success).toBe(false);
    }
  });
});
