import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import {jest} from '@jest/globals';
import type {LanguageModel} from 'ai';
import {createStore} from 'zustand';
import {AiSliceOptions, AiSliceState, createAiSlice} from '../src/AiSlice';

type TestStoreState = AiSliceState & {
  aiSettings?: {
    config: AiSettingsSliceConfig;
  };
};

const now = Date.now();

function createSessionConfig(modelProvider: string, model: string) {
  return {
    currentSessionId: 'session-1',
    openSessionTabs: ['session-1'],
    sessions: [
      {
        id: 'session-1',
        name: 'Session 1',
        modelProvider,
        model,
        createdAt: new Date(now),
        uiMessages: [],
        messagesRevision: 0,
        prompt: '',
        isRunning: false,
        lastOpenedAt: now,
      },
    ],
  };
}

function createSettingsConfig(
  models: Array<{provider: string; modelName: string}> = [],
): AiSettingsSliceConfig {
  const providers: AiSettingsSliceConfig['providers'] = {};
  for (const {provider, modelName} of models) {
    providers[provider] ??= {baseUrl: '', apiKey: '', models: []};
    providers[provider]!.models.push({modelName});
  }
  return {
    providers,
    customModels: [],
    modelParameters: {maxSteps: 50, additionalInstruction: ''},
  };
}

function createStubModel(text: string): LanguageModel {
  const model = {
    specificationVersion: 'v3',
    provider: 'stub',
    modelId: 'stub-model',
    supportedUrls: {},
    doGenerate: async () => ({
      content: [{type: 'text', text}],
      finishReason: 'stop',
      usage: {inputTokens: 1, outputTokens: 1, totalTokens: 2},
      warnings: [],
    }),
    doStream: async () => {
      throw new Error('doStream is not used by generateText');
    },
  } as unknown as LanguageModel;
  return model;
}

function createTestStore(options: {
  getCustomModel?: () => LanguageModel | undefined;
  sessionConfig?: ReturnType<typeof createSessionConfig>;
  aiSettingsConfig?: AiSettingsSliceConfig;
}) {
  const sliceOptions: AiSliceOptions = {
    tools: {} as any,
    getInstructions: () => 'test instructions',
    defaultProvider: 'openai',
    defaultModel: 'shared-model',
    getCustomModel: options.getCustomModel,
    config:
      options.sessionConfig ?? createSessionConfig('openai', 'shared-model'),
  };

  return createStore<TestStoreState>((set, get, store) => ({
    ...createAiSlice(sliceOptions)(set, get, store),
    ...(options.aiSettingsConfig
      ? {aiSettings: {config: options.aiSettingsConfig}}
      : {}),
  }));
}

describe('AiSlice sendPrompt custom model routing', () => {
  it('uses the model returned by getCustomModel instead of building one from settings', async () => {
    const stubModel = createStubModel('custom-model response');
    const getCustomModel = jest.fn<() => LanguageModel | undefined>(
      () => stubModel,
    );
    const store = createTestStore({
      getCustomModel,
      sessionConfig: createSessionConfig('proxy', 'unlisted-model'),
      aiSettingsConfig: createSettingsConfig([]),
    });

    const result = await store.getState().ai.sendPrompt('hello');

    expect(result).toBe('custom-model response');
    expect(getCustomModel).toHaveBeenCalled();
  });

  it('prefers the custom model even when explicit modelProvider/modelName options are passed', async () => {
    const stubModel = createStubModel('proxy always wins');
    const getCustomModel = jest.fn<() => LanguageModel | undefined>(
      () => stubModel,
    );
    const store = createTestStore({
      getCustomModel,
      sessionConfig: createSessionConfig('proxy', 'unlisted-model'),
      aiSettingsConfig: createSettingsConfig([]),
    });

    const result = await store.getState().ai.sendPrompt('hello', {
      modelProvider: 'openai',
      modelName: 'gpt-4.1',
      baseUrl: '',
    });

    expect(result).toBe('proxy always wins');
  });

  it('falls back to the settings-built model when getCustomModel returns undefined', async () => {
    const getCustomModel = jest.fn<() => LanguageModel | undefined>(
      () => undefined,
    );
    const store = createTestStore({
      getCustomModel,
      sessionConfig: createSessionConfig('openai', 'shared-model'),
      aiSettingsConfig: {
        providers: {
          openai: {
            baseUrl: 'https://api.openai.example/v1',
            apiKey: 'openai-key',
            models: [{modelName: 'shared-model'}],
          },
        },
        customModels: [],
        modelParameters: {maxSteps: 50, additionalInstruction: ''},
      },
    });

    const previousFetch = globalThis.fetch;
    const fetchMock = jest.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 0,
            model: 'shared-model',
            choices: [
              {
                index: 0,
                message: {role: 'assistant', content: 'settings response'},
                finish_reason: 'stop',
              },
            ],
            usage: {prompt_tokens: 1, completion_tokens: 1, total_tokens: 2},
          }),
          {status: 200, headers: {'content-type': 'application/json'}},
        ),
    );
    globalThis.fetch = fetchMock;

    try {
      const result = await store.getState().ai.sendPrompt('hello');
      expect(result).toBe('settings response');
      expect(getCustomModel).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it('falls back to the settings-built model when no getCustomModel is configured', async () => {
    const store = createTestStore({
      sessionConfig: createSessionConfig('openai', 'shared-model'),
      aiSettingsConfig: {
        providers: {
          openai: {
            baseUrl: 'https://api.openai.example/v1',
            apiKey: 'openai-key',
            models: [{modelName: 'shared-model'}],
          },
        },
        customModels: [],
        modelParameters: {maxSteps: 50, additionalInstruction: ''},
      },
    });

    const previousFetch = globalThis.fetch;
    const fetchMock = jest.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 0,
            model: 'shared-model',
            choices: [
              {
                index: 0,
                message: {role: 'assistant', content: 'no factory response'},
                finish_reason: 'stop',
              },
            ],
            usage: {prompt_tokens: 1, completion_tokens: 1, total_tokens: 2},
          }),
          {status: 200, headers: {'content-type': 'application/json'}},
        ),
    );
    globalThis.fetch = fetchMock;

    try {
      const result = await store.getState().ai.sendPrompt('hello');
      expect(result).toBe('no factory response');
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  it('logs and falls back to settings when getCustomModel throws', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const store = createTestStore({
      getCustomModel: () => {
        throw new Error('factory exploded');
      },
      sessionConfig: createSessionConfig('openai', 'shared-model'),
      aiSettingsConfig: {
        providers: {
          openai: {
            baseUrl: 'https://api.openai.example/v1',
            apiKey: 'openai-key',
            models: [{modelName: 'shared-model'}],
          },
        },
        customModels: [],
        modelParameters: {maxSteps: 50, additionalInstruction: ''},
      },
    });

    const previousFetch = globalThis.fetch;
    globalThis.fetch = jest.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: 0,
            model: 'shared-model',
            choices: [
              {
                index: 0,
                message: {role: 'assistant', content: 'fallback response'},
                finish_reason: 'stop',
              },
            ],
            usage: {prompt_tokens: 1, completion_tokens: 1, total_tokens: 2},
          }),
          {status: 200, headers: {'content-type': 'application/json'}},
        ),
    );

    try {
      await expect(store.getState().ai.sendPrompt('hello')).resolves.toBe(
        'fallback response',
      );
      expect(consoleError).toHaveBeenCalledWith(
        'getCustomModel threw; treating it as unavailable:',
        expect.any(Error),
      );
    } finally {
      globalThis.fetch = previousFetch;
      consoleError.mockRestore();
    }
  });

  it('answers instead of reporting a failure for a selection registered with an empty baseUrl/apiKey', async () => {
    const stubModel = createStubModel('ok');
    const store = createTestStore({
      getCustomModel: () => stubModel,
      sessionConfig: createSessionConfig('proxy', 'unlisted-model'),
      aiSettingsConfig: createSettingsConfig([]),
    });

    await expect(store.getState().ai.sendPrompt('hello')).resolves.toBe('ok');
  });
});
