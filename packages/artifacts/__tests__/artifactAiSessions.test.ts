import {ChatSessionSchema} from '@sqlrooms/ai-config';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {createStore} from 'zustand';
import {
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactsSliceState,
} from '../src';
import {
  cleanupAiSessionArtifacts,
  createArtifactAiSlice,
  getAiSessionGroupsByArtifact,
  getAiSessionIdsForArtifact,
  getLatestAiSessionIdForArtifact,
  getOwningArtifactRunContextItems,
  getRunningAiSessionCountsByArtifact,
  isAiSessionVisibleForArtifact,
  type ArtifactAiSliceState,
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

function createTestStore() {
  const artifactTypes = defineArtifactTypes({
    dashboard: {
      label: 'Dashboard',
      defaultTitle: 'Dashboard',
    },
    worksheet: {
      label: 'Worksheet',
      defaultTitle: 'Worksheet',
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
    ...createArtifactAiSlice({autoSync: false})(set, get, storeApi),
  }));

  store.getState().artifacts.ensureArtifact('artifact-a', {
    type: 'dashboard',
    title: 'Dashboard A',
  });
  store.getState().artifacts.ensureArtifact('artifact-b', {
    type: 'worksheet',
    title: 'Worksheet B',
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
  const aiSessionArtifacts = {
    'session-a-old': 'artifact-a',
    'session-a-new': 'artifact-a',
    'session-b': 'artifact-b',
  };

  it('filters and selects only explicitly artifact-owned sessions', () => {
    expect(
      isAiSessionVisibleForArtifact(
        aiSessionArtifacts,
        'session-a-new',
        'artifact-a',
      ),
    ).toBe(true);
    expect(
      isAiSessionVisibleForArtifact(
        aiSessionArtifacts,
        'session-unowned',
        'artifact-a',
      ),
    ).toBe(false);
    expect(
      getAiSessionIdsForArtifact({
        sessions,
        aiSessionArtifacts,
        artifactId: 'artifact-a',
      }),
    ).toEqual(['session-a-old', 'session-a-new']);
    expect(
      getLatestAiSessionIdForArtifact({
        sessions,
        aiSessionArtifacts,
        artifactId: 'artifact-a',
      }),
    ).toBe('session-a-new');
  });

  it('groups and counts running sessions by artifact', () => {
    expect(
      getAiSessionGroupsByArtifact({sessions, aiSessionArtifacts}),
    ).toEqual({
      'artifact-a': ['session-a-old', 'session-a-new'],
      'artifact-b': ['session-b'],
    });
    expect(
      getRunningAiSessionCountsByArtifact({sessions, aiSessionArtifacts}),
    ).toEqual({
      'artifact-a': 1,
      'artifact-b': 1,
    });
  });

  it('removes mappings for deleted sessions and artifacts', () => {
    expect(
      cleanupAiSessionArtifacts({
        aiSessionArtifacts: {
          ...aiSessionArtifacts,
          'deleted-session': 'artifact-a',
          'session-a-new': 'deleted-artifact',
        },
        sessions,
        artifactIds: ['artifact-a', 'artifact-b'],
      }),
    ).toEqual({
      'session-a-old': 'artifact-a',
      'session-b': 'artifact-b',
    });
  });

  it('prepends the owning artifact to run context items', () => {
    expect(
      getOwningArtifactRunContextItems({
        sessionId: 'session-a-new',
        aiSessionArtifacts,
        artifactsById: {
          'artifact-a': {
            id: 'artifact-a',
            type: 'dashboard',
            title: 'Dashboard A',
          },
          'artifact-b': {
            id: 'artifact-b',
            type: 'worksheet',
            title: 'Worksheet B',
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
            type: 'worksheet',
            title: 'Worksheet B',
          },
        ],
      }).map((item) => item.id),
    ).toEqual(['artifact-a', 'artifact-b']);
  });
});

describe('createArtifactAiSlice', () => {
  it('creates artifact-scoped sessions for the current artifact', () => {
    const store = createTestStore();

    store.getState().artifacts.setCurrentArtifact('artifact-a');
    const sessionId = store.getState().artifactAi.createArtifactScopedSession();

    expect(sessionId).toBe('session-1');
    expect(store.getState().artifactAi.getSessionArtifactId('session-1')).toBe(
      'artifact-a',
    );
    expect(store.getState().ai.config.currentSessionId).toBe('session-1');
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
        draft.artifactAi.config.aiSessionArtifacts = {
          'source-session': 'artifact-a',
        };
      }),
    );

    store.getState().artifactAi.syncCurrentArtifactAiSession();

    expect(
      store.getState().artifactAi.getSessionArtifactId('target-session'),
    ).toBe('artifact-a');
    expect(store.getState().ai.config.currentSessionId).toBe('target-session');
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
        draft.artifactAi.config.aiSessionArtifacts = {
          'owned-older': 'artifact-a',
          'owned-newer': 'artifact-a',
        };
      }),
    );

    store.getState().artifactAi.selectLatestSessionForArtifact('artifact-a');

    expect(store.getState().ai.config.currentSessionId).toBe('owned-newer');
  });

  it('clears the current session when the current artifact has no owned sessions', () => {
    const store = createTestStore();
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [createSession('unowned', 1)];
        draft.ai.config.currentSessionId = 'unowned';
      }),
    );

    store.getState().artifactAi.syncCurrentArtifactAiSession();

    expect(store.getState().ai.config.currentSessionId).toBeUndefined();
  });

  it('cleans up stale mappings', () => {
    const store = createTestStore();
    store.setState(
      produce(store.getState(), (draft: TestRoomState) => {
        draft.ai.config.sessions = [createSession('session-a', 1)];
        draft.artifactAi.config.aiSessionArtifacts = {
          'session-a': 'artifact-a',
          'deleted-session': 'artifact-a',
          'session-b': 'deleted-artifact',
        };
      }),
    );

    store.getState().artifactAi.cleanupSessionArtifacts();

    expect(store.getState().artifactAi.config.aiSessionArtifacts).toEqual({
      'session-a': 'artifact-a',
    });
  });
});
