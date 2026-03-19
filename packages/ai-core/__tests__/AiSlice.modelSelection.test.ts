import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import {createStore} from 'zustand';
import {AiSliceState, createAiSlice} from '../src/AiSlice';

type TestStoreState = AiSliceState & {
  aiSettings: {
    config: AiSettingsSliceConfig;
  };
};

function createTestStore() {
  const now = Date.now();
  const settingsConfig: AiSettingsSliceConfig = {
    providers: {
      openai: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'openai-key',
        models: [{modelName: 'shared-model'}],
      },
      anthropic: {
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'anthropic-key',
        models: [{modelName: 'shared-model'}],
      },
    },
    customModels: [],
    modelParameters: {
      maxSteps: 50,
      additionalInstruction: '',
    },
  };

  return createStore<TestStoreState>((set, get, store) => ({
    ...createAiSlice({
      tools: {} as any,
      getInstructions: () => 'test instructions',
      defaultProvider: 'openai',
      defaultModel: 'shared-model',
      config: {
        currentSessionId: 'session-1',
        openSessionTabs: ['session-1'],
        sessions: [
          {
            id: 'session-1',
            name: 'Session 1',
            modelProvider: 'openai',
            model: 'shared-model',
            analysisResults: [],
            createdAt: new Date(now),
            uiMessages: [],
            messagesRevision: 0,
            prompt: '',
            isRunning: false,
            lastOpenedAt: now,
          },
        ],
      },
    })(set, get, store),
    aiSettings: {
      config: settingsConfig,
    },
  }));
}

describe('AiSlice model selection', () => {
  it('switches provider without ambiguity when model names are identical', () => {
    const store = createTestStore();

    store.getState().ai.setAiModel('anthropic', 'shared-model');
    const currentSession = store.getState().ai.getCurrentSession();

    expect(currentSession?.modelProvider).toBe('anthropic');
    expect(currentSession?.model).toBe('shared-model');
  });

  it('resolves API key and base URL using provider + model pair', () => {
    const store = createTestStore();

    expect(store.getState().ai.getApiKeyFromSettings()).toBe('openai-key');
    expect(store.getState().ai.getBaseUrlFromSettings()).toBe(
      'https://api.openai.com/v1',
    );

    store.getState().ai.setAiModel('anthropic', 'shared-model');

    expect(store.getState().ai.getApiKeyFromSettings()).toBe('anthropic-key');
    expect(store.getState().ai.getBaseUrlFromSettings()).toBe(
      'https://api.anthropic.com',
    );
  });

  it('inherits current provider and model when creating a new session', () => {
    const store = createTestStore();

    store.getState().ai.setAiModel('anthropic', 'shared-model');
    const previousSessionId = store.getState().ai.config.currentSessionId;

    store.getState().ai.createSession();
    const currentSession = store.getState().ai.getCurrentSession();

    expect(currentSession).toBeDefined();
    expect(currentSession?.id).not.toBe(previousSessionId);
    expect(currentSession?.modelProvider).toBe('anthropic');
    expect(currentSession?.model).toBe('shared-model');
  });
});
