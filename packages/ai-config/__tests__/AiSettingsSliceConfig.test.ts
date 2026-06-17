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
  it('adds code defaults while preserving persisted provider fields and user additions', () => {
    const merged = AiSettingsSliceConfig.parse({
      defaults,
      persisted: {
        providers: {
          openai: {
            baseUrl: 'https://custom-openai.example/v1',
            apiKey: 'sk-test',
            models: [{modelName: 'gpt-5'}, {modelName: 'legacy-model'}],
          },
          customProvider: {
            baseUrl: 'https://custom.example',
            apiKey: 'custom-key',
            models: [{modelName: 'custom-provider-model'}],
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

    expect(Object.keys(merged.providers)).toEqual([
      'openai',
      'anthropic',
      'customProvider',
    ]);
    expect(merged.providers.openai.baseUrl).toBe(
      'https://custom-openai.example/v1',
    );
    expect(merged.providers.openai.apiKey).toBe('sk-test');
    expect(merged.providers.openai.models.map((m) => m.modelName)).toEqual([
      'gpt-5',
      'gpt-4.1',
      'legacy-model',
    ]);
    expect(merged.providers.anthropic.models.map((m) => m.modelName)).toEqual([
      'claude-3-5-sonnet',
    ]);
    expect(
      merged.providers.customProvider.models.map((m) => m.modelName),
    ).toEqual(['custom-provider-model']);
    expect(merged.customModels.map((m) => m.modelName)).toEqual(['qwen3']);
    expect(merged.modelParameters.maxSteps).toBe(12);
  });

  it('falls back to defaults when persisted settings are missing', () => {
    const merged = AiSettingsSliceConfig.parse({
      defaults,
      persisted: undefined,
    });

    expect(merged).toEqual(AiSettingsSliceConfig.parse(defaults));
  });

  it('normalizes nullable provider metadata from runtime config', () => {
    const parsed = AiSettingsSliceConfig.parse({
      providers: {
        'litellm-staging': {
          baseUrl: 'https://litellm.example/',
          models: [{modelName: 'claude-sonnet-4.5'}],
          defaultAuthMethod: null,
          authMethodType: null,
        },
      },
      customModels: [],
      modelParameters: {
        maxSteps: 50,
        additionalInstruction: '',
      },
    });

    expect(parsed.providers['litellm-staging'].defaultAuthMethod).toBeUndefined();
    expect(parsed.providers['litellm-staging'].authMethodType).toBeUndefined();
  });

  it('uses upstream URLs for editable provider settings when runtime config is proxied', () => {
    const parsed = AiSettingsSliceConfig.parse({
      providers: {
        openai: {
          baseUrl: 'http://127.0.0.1:4173/api/ai/proxy/openai/v1',
          upstreamBaseUrl: 'https://api.openai.com/v1',
          models: [],
        },
      },
      customModels: [],
      modelParameters: {
        maxSteps: 50,
        additionalInstruction: '',
      },
    });

    expect(parsed.providers.openai.baseUrl).toBe('https://api.openai.com/v1');
    expect(parsed.providers.openai.upstreamBaseUrl).toBe(
      'https://api.openai.com/v1',
    );
  });
});
