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

function createTestStore(options?: {
  getCustomModel?: () => LanguageModel | undefined;
  aiSettingsConfig?: AiSettingsSliceConfig;
  sessionConfig?: ReturnType<typeof createSessionConfig>;
  chatEndPoint?: string;
}) {
  const sliceOptions: AiSliceOptions = {
    tools: {} as any,
    getInstructions: () => 'test instructions',
    defaultProvider: 'openai',
    defaultModel: 'shared-model',
    getCustomModel: options?.getCustomModel,
    chatEndPoint: options?.chatEndPoint,
    config:
      options?.sessionConfig ?? createSessionConfig('openai', 'shared-model'),
  };

  return createStore<TestStoreState>((set, get, store) => ({
    ...createAiSlice(sliceOptions)(set, get, store),
    ...(options?.aiSettingsConfig
      ? {aiSettings: {config: options.aiSettingsConfig}}
      : {}),
  }));
}

function createSettingsConfig(
  models: Array<{provider: string; modelName: string}>,
  customModelNames: string[] = [],
): AiSettingsSliceConfig {
  const providers: AiSettingsSliceConfig['providers'] = {};
  for (const {provider, modelName} of models) {
    providers[provider] ??= {baseUrl: '', apiKey: '', models: []};
    providers[provider]!.models.push({modelName});
  }
  return {
    providers,
    customModels: customModelNames.map((modelName) => ({
      modelName,
      baseUrl: '',
      apiKey: '',
    })),
    modelParameters: {maxSteps: 50, additionalInstruction: ''},
  };
}

describe('AiSlice hasResolvableModel', () => {
  it('is resolvable when the current model is present in the ai-settings model list', () => {
    const store = createTestStore({
      aiSettingsConfig: createSettingsConfig([
        {provider: 'openai', modelName: 'shared-model'},
      ]),
      sessionConfig: createSessionConfig('openai', 'shared-model'),
    });

    expect(store.getState().ai.hasResolvableModel()).toBe(true);
  });

  it('is not resolvable when the current model is absent from the ai-settings model list', () => {
    const store = createTestStore({
      aiSettingsConfig: createSettingsConfig([
        {provider: 'openai', modelName: 'other-model'},
      ]),
      sessionConfig: createSessionConfig('openai', 'shared-model'),
    });

    expect(store.getState().ai.hasResolvableModel()).toBe(false);
  });

  it('is resolvable when a custom-model factory was configured, even with an empty settings model list', () => {
    // This is the case that previously forced consumers streaming through a
    // server-side model proxy to register a phantom settings entry.
    const store = createTestStore({
      getCustomModel: () => undefined,
      aiSettingsConfig: createSettingsConfig([]),
      sessionConfig: createSessionConfig('proxy', 'unlisted-model'),
    });

    expect(store.getState().ai.hasResolvableModel()).toBe(true);
  });

  it('is resolvable when the current model matches a custom model entry in ai-settings', () => {
    const store = createTestStore({
      aiSettingsConfig: createSettingsConfig([], ['my-custom-model']),
      sessionConfig: createSessionConfig('custom', 'my-custom-model'),
    });

    expect(store.getState().ai.hasResolvableModel()).toBe(true);
  });

  it('is resolvable via the union of a providers["custom"] entry and an empty customModels list (arbitrary provider keys)', () => {
    // `config.providers` accepts arbitrary string keys, so a `'custom'`
    // provider entry there is a distinct source from `config.customModels`.
    // The old `extractModelsFromSettings(...).some(...)` check treated a
    // 'custom' match as the union of both; this locks in that the
    // non-allocating replacement preserves that union rather than picking
    // only one source.
    const store = createTestStore({
      aiSettingsConfig: createSettingsConfig([
        {provider: 'custom', modelName: 'm'},
      ]),
      sessionConfig: createSessionConfig('custom', 'm'),
    });
    // Sanity-check the fixture: customModels is empty, so only the
    // providers['custom'] entry can be the source of a match.
    expect(store.getState().aiSettings?.config.customModels).toEqual([]);

    expect(store.getState().ai.hasResolvableModel()).toBe(true);
  });

  it('is resolvable when no ai-settings slice is installed and the session has a provider/model pair', () => {
    const store = createTestStore({
      sessionConfig: createSessionConfig('openai', 'shared-model'),
    });

    expect(store.getState().ai.hasResolvableModel()).toBe(true);
  });

  it('is not resolvable when no path provides a model', () => {
    const store = createTestStore({
      aiSettingsConfig: createSettingsConfig([]),
      sessionConfig: createSessionConfig('openai', 'shared-model'),
    });

    expect(store.getState().ai.hasResolvableModel()).toBe(false);
  });

  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'is not resolvable (and does not throw) when the session provider is the prototype-chain name %s with no own provider entry of that name',
    (prototypeChainProviderName) => {
      // `config.providers` is a plain object. Indexing it with one of these
      // names resolves an inherited Object.prototype member instead of
      // `undefined` when there is no *own* provider entry of that name, so a
      // naive lookup would treat the hit as present and crash on the
      // following property access rather than reporting "not resolvable".
      const store = createTestStore({
        aiSettingsConfig: createSettingsConfig([
          {provider: 'openai', modelName: 'gpt-4'},
        ]),
        sessionConfig: createSessionConfig(prototypeChainProviderName, 'gpt-4'),
      });

      expect(() => store.getState().ai.hasResolvableModel()).not.toThrow();
      expect(store.getState().ai.hasResolvableModel()).toBe(false);
    },
  );

  it('is not resolvable via a provider entry inherited from the prototype chain rather than owned by config.providers', () => {
    // Isolates the own-property guard itself (as distinct from the previous
    // test's crash guard): none of the four prototype-chain names carry a
    // `.models` array, so a defensive `?.models?.some(...)` alone already
    // prevents a throw for them, and would pass even without an own-property
    // check. This fixture instead gives an *inherited* provider entry a real
    // `.models` array, so only an explicit own-property check (matching
    // `Object.entries`' own-keys-only enumeration) reports it as absent.
    const inheritedProviders = Object.create({
      inherited: {baseUrl: '', apiKey: '', models: [{modelName: 'ghost'}]},
    }) as AiSettingsSliceConfig['providers'];

    const store = createTestStore({
      aiSettingsConfig: {
        providers: inheritedProviders,
        customModels: [],
        modelParameters: {maxSteps: 50, additionalInstruction: ''},
      },
      sessionConfig: createSessionConfig('inherited', 'ghost'),
    });

    expect(() => store.getState().ai.hasResolvableModel()).not.toThrow();
    expect(store.getState().ai.hasResolvableModel()).toBe(false);
  });

  it('does not invoke the configured custom-model factory while computing readiness', () => {
    const getCustomModel = jest.fn<() => LanguageModel | undefined>(
      () => undefined,
    );
    const store = createTestStore({getCustomModel});

    expect(store.getState().ai.hasResolvableModel()).toBe(true);
    expect(getCustomModel).not.toHaveBeenCalled();
  });
});

describe('AiSlice requiresApiKey', () => {
  /** A stand-in for a host-constructed model; never invoked by these tests. */
  const someModel = {} as LanguageModel;

  it('does not require a key when a configured factory returns a model', () => {
    // That model carries its own credentials — a server-side proxy, typically —
    // so the built-in OpenAI-compatible client that consumes a browser-held key
    // is never reached.
    const store = createTestStore({
      getCustomModel: () => someModel,
      aiSettingsConfig: createSettingsConfig([]),
      sessionConfig: createSessionConfig('proxy', 'unlisted-model'),
    });

    expect(store.getState().ai.requiresApiKey()).toBe(false);
  });

  it('requires a key when a configured factory returns undefined', () => {
    // The transport falls back to the OpenAI-compatible client in exactly this
    // case (see `chatTransport`), and that client does consume the settings
    // key. Reporting "no key needed" here would hide the inline key input and
    // leave the user unable to supply a credential the request needs.
    const store = createTestStore({
      getCustomModel: () => undefined,
      aiSettingsConfig: createSettingsConfig([]),
      sessionConfig: createSessionConfig('proxy', 'unlisted-model'),
    });

    expect(store.getState().ai.requiresApiKey()).toBe(true);
  });

  it('requires a key when no custom-model factory was configured', () => {
    const store = createTestStore({
      aiSettingsConfig: createSettingsConfig([
        {provider: 'openai', modelName: 'shared-model'},
      ]),
      sessionConfig: createSessionConfig('openai', 'shared-model'),
    });

    expect(store.getState().ai.requiresApiKey()).toBe(true);
  });

  it('invokes the factory, unlike hasResolvableModel', () => {
    // The asymmetry is deliberate: readiness can guess optimistically because
    // the cost is a failed send, but guessing about credentials hides the only
    // UI for entering one. Documented on both predicates.
    const getCustomModel = jest.fn<() => LanguageModel | undefined>(
      () => someModel,
    );
    const store = createTestStore({getCustomModel});

    store.getState().ai.requiresApiKey();
    expect(getCustomModel).toHaveBeenCalledTimes(1);

    getCustomModel.mockClear();
    store.getState().ai.hasResolvableModel();
    expect(getCustomModel).not.toHaveBeenCalled();
  });

  it('does not require a key when a remote chat endpoint is configured', () => {
    // The remote transport sends server-side, so the browser never holds a
    // provider key however the model resolves. Without this, a remote-backed
    // app is gated behind credential entry it has no use for.
    const store = createTestStore({
      chatEndPoint: 'https://example.test/chat',
      aiSettingsConfig: createSettingsConfig([]),
    });

    expect(store.getState().ai.requiresApiKey()).toBe(false);
  });

  it('calls the factory once across repeated reads for one selection', () => {
    // Read from a selector that re-runs on every store mutation — once per
    // streamed token — and the apps configuring a factory are exactly the ones
    // with no key, so no key-based short-circuit covers them.
    const getCustomModel = jest.fn<() => LanguageModel | undefined>(
      () => someModel,
    );
    const store = createTestStore({getCustomModel});

    for (let i = 0; i < 25; i++) store.getState().ai.requiresApiKey();

    expect(getCustomModel).toHaveBeenCalledTimes(1);
  });

  it('re-probes the factory when the selected model changes', () => {
    // The cache key is the resolved selection, so a factory that answers
    // differently per model is still asked again when the model changes.
    const getCustomModel = jest.fn<() => LanguageModel | undefined>(
      () => someModel,
    );
    const store = createTestStore({getCustomModel});

    store.getState().ai.requiresApiKey();
    expect(getCustomModel).toHaveBeenCalledTimes(1);

    store.getState().ai.setAiModel('openai', 'a-different-model');
    store.getState().ai.requiresApiKey();
    expect(getCustomModel).toHaveBeenCalledTimes(2);
  });

  it('does not re-probe a selection it has already seen (A -> B -> A)', () => {
    // A single-slot cache would re-invoke for A on the way back, repeating any
    // side effect the factory has.
    const getCustomModel = jest.fn<() => LanguageModel | undefined>(
      () => someModel,
    );
    const store = createTestStore({getCustomModel});

    store.getState().ai.requiresApiKey();
    store.getState().ai.setAiModel('openai', 'model-b');
    store.getState().ai.requiresApiKey();
    store.getState().ai.setAiModel('openai', 'shared-model');
    store.getState().ai.requiresApiKey();

    expect(getCustomModel).toHaveBeenCalledTimes(2);
  });

  it('caches an undefined answer rather than re-probing for it', () => {
    // `undefined` means "a key is needed" — a real answer, not a cache miss.
    const getCustomModel = jest.fn<() => LanguageModel | undefined>(
      () => undefined,
    );
    const store = createTestStore({getCustomModel});

    for (let i = 0; i < 10; i++) {
      expect(store.getState().ai.requiresApiKey()).toBe(true);
    }

    expect(getCustomModel).toHaveBeenCalledTimes(1);
  });

  it('requires a key, and does not throw, when the factory throws', () => {
    // This runs inside a Zustand selector, so propagating would crash a render.
    const store = createTestStore({
      getCustomModel: () => {
        throw new Error('provider misconfigured');
      },
    });

    expect(() => store.getState().ai.requiresApiKey()).not.toThrow();
    expect(store.getState().ai.requiresApiKey()).toBe(true);
  });
});
