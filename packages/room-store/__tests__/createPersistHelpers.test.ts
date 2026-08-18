import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import {z} from 'zod';
import {createStore, StateCreator} from 'zustand/vanilla';
import {PersistOptions, PersistStorage, StateStorage} from 'zustand/middleware';
import {
  createPersistHelpers,
  persistSliceConfigs,
} from '../src/createPersistHelpers';

const PersistMergeInputSymbol = Symbol.for('sqlrooms.persist.mergeInput');

const defaults = {
  providers: {
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      models: [{modelName: 'gpt-5'}, {modelName: 'gpt-4.1'}],
    },
    anthropic: {
      baseUrl: 'https://api.anthropic.com/v1',
      apiKey: '',
      models: [{modelName: 'claude-3-5-sonnet'}],
    },
  },
  customModels: [],
  modelParameters: {
    maxSteps: 50,
    additionalInstruction: '',
  },
};

describe('createPersistHelpers.merge', () => {
  it('keeps current state when persisted slice is missing', () => {
    const helpers = createPersistHelpers({
      room: z.object({title: z.string()}),
      aiSettings: AiSettingsSliceConfig,
    });

    const currentState = {
      room: {config: {title: 'Demo room'}},
      aiSettings: {config: defaults},
    };

    const merged = helpers.merge(undefined, currentState);

    expect(merged).toEqual(currentState);
  });

  it('applies defaults-aware aiSettings merge on rehydrate', () => {
    const helpers = createPersistHelpers({
      aiSettings: AiSettingsSliceConfig,
    });

    const currentState = {
      aiSettings: {
        config: defaults,
      },
    };

    const merged = helpers.merge(
      {
        aiSettings: {
          providers: {
            openai: {
              baseUrl: 'https://custom-openai.example/v1',
              apiKey: 'sk-test',
              models: [{modelName: 'gpt-5'}, {modelName: 'legacy-model'}],
            },
            customProvider: {
              baseUrl: 'https://custom.example/v1',
              apiKey: 'custom-key',
              models: [{modelName: 'custom-provider-model'}],
            },
          },
          customModels: [],
          modelParameters: {maxSteps: 20, additionalInstruction: ''},
        },
      },
      currentState,
    );

    expect(Object.keys(merged.aiSettings.config.providers)).toEqual([
      'openai',
      'anthropic',
      'customProvider',
    ]);
    expect(
      merged.aiSettings.config.providers.openai.models.map(
        (m: {modelName: string}) => m.modelName,
      ),
    ).toEqual(['gpt-5', 'gpt-4.1', 'legacy-model']);
    expect(
      merged.aiSettings.config.providers.customProvider.models.map(
        (m: {modelName: string}) => m.modelName,
      ),
    ).toEqual(['custom-provider-model']);
    expect(merged.aiSettings.config.providers.openai.baseUrl).toBe(
      'https://custom-openai.example/v1',
    );
  });

  it('supports schema-driven defaults merge without key coupling', () => {
    const ToggleConfig = Object.assign(
      z.object({
        enabled: z.boolean(),
        limit: z.number(),
      }),
      {
        [PersistMergeInputSymbol]: ({
          defaults,
          persisted,
        }: {
          defaults: unknown;
          persisted: unknown;
        }) => ({
          ...(defaults as Record<string, unknown>),
          ...(persisted as Record<string, unknown>),
        }),
      },
    );

    const helpers = createPersistHelpers({
      featureToggle: ToggleConfig,
    });

    const merged = helpers.merge(
      {
        featureToggle: {
          enabled: false,
        },
      },
      {
        featureToggle: {
          config: {
            enabled: true,
            limit: 10,
          },
        },
      },
    );

    expect(merged.featureToggle.config).toEqual({
      enabled: false,
      limit: 10,
    });
  });
});

const CounterConfig = z.object({count: z.number()});
type PersistedCounterState = {counter: z.infer<typeof CounterConfig>};

type CounterState = {
  counter: {
    config: z.infer<typeof CounterConfig>;
    increment: () => void;
  };
};

const counterStateCreator: StateCreator<CounterState> = (set) => ({
  counter: {
    config: {count: 0},
    increment: () =>
      set((state) => ({
        counter: {
          ...state.counter,
          config: {count: state.counter.config.count + 1},
        },
      })),
  },
});

function createCounterStore(
  storage?: PersistStorage<PersistedCounterState>,
  onRehydrateStorage?: PersistOptions<
    CounterState,
    PersistedCounterState
  >['onRehydrateStorage'],
) {
  return createStore(
    persistSliceConfigs(
      {
        name: 'counter-test-storage',
        sliceConfigSchemas: {counter: CounterConfig},
        ...(storage ? {storage} : {}),
        ...(onRehydrateStorage ? {onRehydrateStorage} : {}),
      },
      counterStateCreator,
    ),
  );
}

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'window',
);

function setWindowStorage(storage: StateStorage | null) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {localStorage: storage},
  });
}

describe('persistSliceConfigs storage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
    } else {
      delete (globalThis as {window?: unknown}).window;
    }
  });

  it('continues updating state when default browser storage is unavailable', () => {
    setWindowStorage(null);

    const store = createCounterStore();

    expect(() => store.getState().counter.increment()).not.toThrow();
    expect(store.getState().counter.config.count).toBe(1);
  });

  it('continues updating state when resolving browser storage throws', () => {
    const browserWindow = {};
    Object.defineProperty(browserWindow, 'localStorage', {
      get: () => {
        throw new Error('Storage access denied');
      },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: browserWindow,
    });

    const store = createCounterStore();

    expect(() => store.getState().counter.increment()).not.toThrow();
    expect(store.getState().counter.config.count).toBe(1);
  });

  it('uses default browser storage when it is available', () => {
    const values = new Map<string, string>();
    const storage: StateStorage = {
      getItem: jest.fn((key) => values.get(key) ?? null),
      setItem: jest.fn((key, value) => values.set(key, value)),
      removeItem: jest.fn((key) => values.delete(key)),
    };
    setWindowStorage(storage);

    const store = createCounterStore();
    store.getState().counter.increment();

    expect(storage.setItem).toHaveBeenCalled();
    expect(JSON.parse(values.get('counter-test-storage') ?? '')).toEqual({
      state: {counter: {count: 1}},
      version: 0,
    });
  });

  it('propagates custom reads while tolerating write and removal failures', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const getItemError = new Error('getItem failed');
    const onHydrationFinished = jest.fn();
    const storage: PersistStorage<{counter: {count: number}}> = {
      getItem: () => {
        throw getItemError;
      },
      setItem: () => {
        throw new Error('setItem failed');
      },
      removeItem: () => {
        throw new Error('removeItem failed');
      },
    };

    const store = createCounterStore(storage, () => onHydrationFinished);

    expect(onHydrationFinished).toHaveBeenCalledWith(undefined, getItemError);
    expect(() => store.getState().counter.increment()).not.toThrow();
    expect(() =>
      (
        store as typeof store & {persist: {clearStorage: () => void}}
      ).persist.clearStorage(),
    ).not.toThrow();
    expect(store.getState().counter.config.count).toBe(1);
  });
});
