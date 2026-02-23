import {createStore} from 'zustand';
import {
  createAiSlice,
  AiSliceState,
  AiSliceOptions,
} from '../src/AiSlice';
import {createBaseRoomSlice, BaseRoomStoreState} from '@sqlrooms/room-store';
import {OpenAssistantToolSet} from '@openassistant/utils';

type TestStoreState = BaseRoomStoreState & AiSliceState;

const mockTools: OpenAssistantToolSet = {};

const mockOptions: AiSliceOptions = {
  tools: mockTools,
  getInstructions: () => 'Test instructions',
  defaultProvider: 'openai',
  defaultModel: 'gpt-4',
};

function createTestStore(options = mockOptions) {
  return createStore<TestStoreState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createAiSlice(options)(...args),
  }));
}

describe('AiSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(async () => {
    store = createTestStore();
    await store.getState().ai.initialize?.();
  });

  afterEach(async () => {
    await store.getState().ai.destroy?.();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = store.getState().ai.config;
      expect(config).toBeDefined();
      expect(config.sessions).toBeDefined();
      expect(Array.isArray(config.sessions)).toBe(true);
    });

    it('should initialize with prompt suggestions visible', () => {
      expect(store.getState().ai.promptSuggestionsVisible).toBe(true);
    });

    it('should initialize with empty API key errors', () => {
      expect(store.getState().ai.apiKeyErrors).toEqual({});
    });

    it('should store provided tools', () => {
      expect(store.getState().ai.tools).toBe(mockTools);
    });
  });

  describe('session management', () => {
    describe('createSession', () => {
      it('should create a new session', () => {
        const initialCount = store.getState().ai.config.sessions.length;

        store.getState().ai.createSession('Test Session');

        expect(store.getState().ai.config.sessions.length).toBe(
          initialCount + 1,
        );
      });

      it('should create session with default name if not provided', () => {
        store.getState().ai.createSession();

        const sessions = store.getState().ai.config.sessions;
        const newSession = sessions[0];
        expect(newSession?.name).toContain('Session');
      });

      it('should set new session as current', () => {
        store.getState().ai.createSession('New Session');

        const currentSession = store.getState().ai.getCurrentSession();
        expect(currentSession?.name).toBe('New Session');
      });

      it('should use default provider and model', () => {
        store.getState().ai.createSession();

        const currentSession = store.getState().ai.getCurrentSession();
        expect(currentSession?.modelProvider).toBe('openai');
        expect(currentSession?.model).toBe('gpt-4');
      });

      it('should allow custom provider and model', () => {
        store.getState().ai.createSession('Custom', 'anthropic', 'claude-3');

        const currentSession = store.getState().ai.getCurrentSession();
        expect(currentSession?.modelProvider).toBe('anthropic');
        expect(currentSession?.model).toBe('claude-3');
      });

      it('should add to open session tabs', () => {
        store.getState().ai.createSession('Tab Test');

        const currentSession = store.getState().ai.getCurrentSession();
        expect(store.getState().ai.config.openSessionTabs).toContain(
          currentSession?.id,
        );
      });
    });

    describe('switchSession', () => {
      it('should switch to existing session', () => {
        const session1 = store.getState().ai.getCurrentSession();
        store.getState().ai.createSession('Session 2');
        const session2Id = store.getState().ai.config.currentSessionId;

        if (session1?.id) {
          store.getState().ai.switchSession(session1.id);
          expect(store.getState().ai.config.currentSessionId).toBe(session1.id);
        }
      });

      it('should add session to open tabs if not already there', () => {
        store.getState().ai.createSession('Session for tabs');
        const sessionId = store.getState().ai.config.currentSessionId;

        // Clear open tabs
        store.getState().ai.setOpenSessionTabs([]);

        if (sessionId) {
          store.getState().ai.switchSession(sessionId);
          expect(store.getState().ai.config.openSessionTabs).toContain(
            sessionId,
          );
        }
      });
    });

    describe('renameSession', () => {
      it('should rename a session', () => {
        const session = store.getState().ai.getCurrentSession();

        if (session?.id) {
          store.getState().ai.renameSession(session.id, 'Renamed Session');

          const updated = store
            .getState()
            .ai.config.sessions.find((s) => s.id === session.id);
          expect(updated?.name).toBe('Renamed Session');
        }
      });
    });

    describe('deleteSession', () => {
      it('should delete a session', () => {
        store.getState().ai.createSession('To Delete');
        const sessionToDelete = store.getState().ai.getCurrentSession();
        const initialCount = store.getState().ai.config.sessions.length;

        if (sessionToDelete?.id) {
          store.getState().ai.deleteSession(sessionToDelete.id);

          expect(store.getState().ai.config.sessions.length).toBe(
            initialCount - 1,
          );
        }
      });

      it('should not delete last session', () => {
        // Ensure only one session exists
        const sessions = store.getState().ai.config.sessions;
        const firstSessionId = sessions[0]?.id;

        if (firstSessionId && sessions.length === 1) {
          store.getState().ai.deleteSession(firstSessionId);

          expect(store.getState().ai.config.sessions.length).toBe(1);
        }
      });

      it('should remove from open tabs', () => {
        store.getState().ai.createSession('Delete Tab Test');
        const sessionId = store.getState().ai.config.currentSessionId;

        if (sessionId) {
          expect(store.getState().ai.config.openSessionTabs).toContain(
            sessionId,
          );

          // Create another session so we don't delete the last one
          store.getState().ai.createSession('Keep This');

          store.getState().ai.deleteSession(sessionId);

          expect(store.getState().ai.config.openSessionTabs).not.toContain(
            sessionId,
          );
        }
      });
    });

    describe('getCurrentSession', () => {
      it('should return current session', () => {
        const session = store.getState().ai.getCurrentSession();
        expect(session).toBeDefined();
        expect(session?.id).toBe(store.getState().ai.config.currentSessionId);
      });

      it('should return undefined if no current session', () => {
        store.getState().ai.config.currentSessionId = 'non-existent';

        const session = store.getState().ai.getCurrentSession();
        expect(session).toBeUndefined();
      });
    });
  });

  describe('setConfig', () => {
    it('should update AI config', () => {
      const newConfig = {
        sessions: [],
        currentSessionId: 'test-id',
        openSessionTabs: [],
      };

      store.getState().ai.setConfig(newConfig);

      expect(store.getState().ai.config).toEqual(newConfig);
    });
  });

  describe('setPromptSuggestionsVisible', () => {
    it('should toggle prompt suggestions visibility', () => {
      store.getState().ai.setPromptSuggestionsVisible(false);
      expect(store.getState().ai.promptSuggestionsVisible).toBe(false);

      store.getState().ai.setPromptSuggestionsVisible(true);
      expect(store.getState().ai.promptSuggestionsVisible).toBe(true);
    });
  });

  describe('API key error management', () => {
    describe('setApiKeyError', () => {
      it('should set API key error for provider', () => {
        store.getState().ai.setApiKeyError('openai', true);

        expect(store.getState().ai.apiKeyErrors['openai']).toBe(true);
      });

      it('should clear API key error for provider', () => {
        store.getState().ai.setApiKeyError('openai', true);
        store.getState().ai.setApiKeyError('openai', false);

        expect(store.getState().ai.apiKeyErrors['openai']).toBeUndefined();
      });

      it('should handle multiple providers', () => {
        store.getState().ai.setApiKeyError('openai', true);
        store.getState().ai.setApiKeyError('anthropic', true);

        expect(store.getState().ai.apiKeyErrors['openai']).toBe(true);
        expect(store.getState().ai.apiKeyErrors['anthropic']).toBe(true);
      });
    });

    describe('hasApiKeyError', () => {
      it('should return false when no errors', () => {
        expect(store.getState().ai.hasApiKeyError()).toBe(false);
      });

      it('should return true when current provider has error', () => {
        const session = store.getState().ai.getCurrentSession();
        const provider = session?.modelProvider || 'openai';

        store.getState().ai.setApiKeyError(provider, true);

        expect(store.getState().ai.hasApiKeyError()).toBe(true);
      });
    });
  });

  describe('setAiModel', () => {
    it('should update model for current session', () => {
      store.getState().ai.setAiModel('anthropic', 'claude-3-opus');

      const currentSession = store.getState().ai.getCurrentSession();
      expect(currentSession?.modelProvider).toBe('anthropic');
      expect(currentSession?.model).toBe('claude-3-opus');
    });
  });

  describe('setOpenSessionTabs', () => {
    it('should update open session tabs', () => {
      const session1 = store.getState().ai.getCurrentSession();
      store.getState().ai.createSession('Session 2');
      const session2 = store.getState().ai.getCurrentSession();

      if (session1?.id && session2?.id) {
        store.getState().ai.setOpenSessionTabs([session2.id, session1.id]);

        expect(store.getState().ai.config.openSessionTabs).toEqual([
          session2.id,
          session1.id,
        ]);
      }
    });

    it('should filter out non-existent sessions', () => {
      const session = store.getState().ai.getCurrentSession();

      if (session?.id) {
        store
          .getState()
          .ai.setOpenSessionTabs([session.id, 'non-existent-1', 'non-existent-2']);

        expect(store.getState().ai.config.openSessionTabs).toEqual([session.id]);
      }
    });
  });

  describe('prompt management', () => {
    it('should set prompt for session', () => {
      const session = store.getState().ai.getCurrentSession();

      if (session?.id) {
        store.getState().ai.setPrompt(session.id, 'Test prompt');

        expect(store.getState().ai.getPrompt(session.id)).toBe('Test prompt');
      }
    });

    it('should return empty string for non-existent session', () => {
      expect(store.getState().ai.getPrompt('non-existent')).toBe('');
    });
  });

  describe('running state', () => {
    it('should track session running state', () => {
      const session = store.getState().ai.getCurrentSession();

      if (session?.id) {
        store.getState().ai.setIsRunning(session.id, true);
        expect(store.getState().ai.getIsRunning(session.id)).toBe(true);

        store.getState().ai.setIsRunning(session.id, false);
        expect(store.getState().ai.getIsRunning(session.id)).toBe(false);
      }
    });

    it('should return false for non-existent session', () => {
      expect(store.getState().ai.getIsRunning('non-existent')).toBe(false);
    });
  });

  describe('analysis results', () => {
    it('should return analysis results for current session', () => {
      const results = store.getState().ai.getAnalysisResults();
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should return undefined when no current session', () => {
      store.getState().ai.config.currentSessionId = 'non-existent';

      const results = store.getState().ai.getAnalysisResults();
      expect(results).toBeUndefined();
    });
  });

  describe('getFullInstructions', () => {
    it('should return instructions from getInstructions function', () => {
      const instructions = store.getState().ai.getFullInstructions();
      expect(instructions).toBe('Test instructions');
    });
  });

  describe('getMaxStepsFromSettings', () => {
    it('should return maxSteps from options', () => {
      const storeWithMaxSteps = createTestStore({
        ...mockOptions,
        maxSteps: 25,
      });

      expect(storeWithMaxSteps.getState().ai.getMaxStepsFromSettings()).toBe(
        25,
      );
    });

    it('should return default maxSteps when not provided', () => {
      expect(store.getState().ai.getMaxStepsFromSettings()).toBe(50);
    });
  });

  describe('tool call session tracking', () => {
    it('should set and get tool call session', () => {
      const session = store.getState().ai.getCurrentSession();

      if (session?.id) {
        store.getState().ai.setToolCallSession('tool-call-1', session.id);

        expect(store.getState().ai.getToolCallSession('tool-call-1')).toBe(
          session.id,
        );
      }
    });

    it('should clear tool call session', () => {
      store.getState().ai.setToolCallSession('tool-call-1', 'session-1');
      store.getState().ai.setToolCallSession('tool-call-1', undefined);

      expect(
        store.getState().ai.getToolCallSession('tool-call-1'),
      ).toBeUndefined();
    });

    it('should return undefined for non-existent tool call', () => {
      expect(
        store.getState().ai.getToolCallSession('non-existent'),
      ).toBeUndefined();
    });
  });
});