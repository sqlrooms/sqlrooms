import {describe, expect, it} from '@jest/globals';
import {z} from 'zod';
import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';
import {createPersistHelpers} from '../src/createPersistHelpers';

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

  it('applies strict-prune aiSettings merge on rehydrate', () => {
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
            removedProvider: {
              baseUrl: 'https://removed.example/v1',
              apiKey: 'removed-key',
              models: [{modelName: 'removed-model'}],
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
    ]);
    expect(
      merged.aiSettings.config.providers.openai.models.map((m) => m.modelName),
    ).toEqual(['gpt-5', 'gpt-4.1']);
    expect(merged.aiSettings.config.providers.openai.baseUrl).toBe(
      'https://custom-openai.example/v1',
    );
  });
});
