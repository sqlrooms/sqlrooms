import {describe, expect, it} from '@jest/globals';
import {AiSettingsSliceConfig} from '../src/AiSettingsSliceConfig';

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

describe('AiSettingsSliceConfig', () => {
  it('strictly prunes removed providers/models while preserving mutable provider fields', () => {
    const merged = AiSettingsSliceConfig.parse({
      defaults,
      persisted: {
        providers: {
          openai: {
            baseUrl: 'https://custom-openai.example/v1',
            apiKey: 'sk-test',
            models: [{modelName: 'gpt-5'}, {modelName: 'legacy-model'}],
          },
          removedProvider: {
            baseUrl: 'https://removed.example',
            apiKey: 'removed-key',
            models: [{modelName: 'removed-model'}],
          },
        },
        customModels: [
          {
            baseUrl: 'http://localhost:11434/v1',
            apiKey: '',
            modelName: 'qwen3',
          },
        ],
        modelParameters: {
          maxSteps: 12,
          additionalInstruction: 'Always return JSON.',
        },
      },
    });

    expect(Object.keys(merged.providers)).toEqual(['openai', 'anthropic']);
    expect(merged.providers.openai.baseUrl).toBe(
      'https://custom-openai.example/v1',
    );
    expect(merged.providers.openai.apiKey).toBe('sk-test');
    expect(merged.providers.openai.models.map((m) => m.modelName)).toEqual([
      'gpt-5',
      'gpt-4.1',
    ]);
    expect(merged.providers.anthropic.models.map((m) => m.modelName)).toEqual([
      'claude-3-5-sonnet',
    ]);
    expect(merged.customModels.map((m) => m.modelName)).toEqual(['qwen3']);
    expect(merged.modelParameters.maxSteps).toBe(12);
  });

  it('falls back to defaults when persisted settings are missing', () => {
    const merged = AiSettingsSliceConfig.parse({
      defaults,
      persisted: undefined,
    });

    expect(merged).toEqual(defaults);
  });
});
