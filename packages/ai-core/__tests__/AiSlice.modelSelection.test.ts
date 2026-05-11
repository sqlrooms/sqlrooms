import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import type {AiRunContext} from '@sqlrooms/ai-config';
import {jest} from '@jest/globals';
import {createStore} from 'zustand';
import {AiSliceState, createAiSlice} from '../src/AiSlice';

type TestStoreState = AiSliceState & {
  aiSettings: {
    config: AiSettingsSliceConfig;
  };
};

function createTestStore(options?: {
  getRunContext?: () => AiRunContext | undefined;
}) {
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
      getRunContext: options?.getRunContext,
      formatRunContextInstructions: ({runContext}) => {
        const mainItem = runContext.items[0];
        return mainItem ? `Context: ${mainItem.type} ${mainItem.title}` : '';
      },
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

  it('captures run context once when starting analysis', async () => {
    const contextA: AiRunContext = {
      items: [
        {
          kind: 'artifact',
          id: 'map-a',
          type: 'map',
          title: 'Map A',
        },
      ],
      capturedAt: 1,
    };
    const contextB: AiRunContext = {
      items: [
        {
          kind: 'artifact',
          id: 'map-b',
          type: 'map',
          title: 'Map B',
        },
      ],
      capturedAt: 2,
    };
    let activeContext = contextA;
    const store = createTestStore({
      getRunContext: () => activeContext,
    });
    const sendMessage = jest.fn();

    store.getState().ai.setChatSendMessage('session-1', sendMessage);
    store.getState().ai.setPrompt('session-1', 'hello');
    await store.getState().ai.startAnalysis('session-1');
    activeContext = contextB;

    const session = store.getState().ai.config.sessions[0];
    expect(session?.runContext).toEqual(contextA);
    expect(store.getState().ai.getFullInstructions('session-1')).toContain(
      'Map A',
    );
    expect(store.getState().ai.getFullInstructions('session-1')).not.toContain(
      'Map B',
    );
    expect(sendMessage).toHaveBeenCalledWith({text: 'hello'});
  });
});
