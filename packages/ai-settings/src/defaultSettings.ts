import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';

export function createDefaultAiSettingsConfig(
  props?: Partial<AiSettingsSliceConfig>,
): AiSettingsSliceConfig {
  return {
    defaultProvider: 'openai',
    defaultModel: 'gpt-4.1',
    providers: {
      openai: {
        title: 'OpenAI',
        kind: 'builtin',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        models: [
          {
            modelName: 'gpt-4.1',
          },
          {
            modelName: 'gpt-5',
          },
        ],
        defaultAuthMethod: 'manual_api_key',
        experimental: false,
        authMethods: [
          {
            id: 'manual_api_key',
            type: 'api_key',
            label: 'Manually enter API Key',
            description: '',
            experimental: false,
            metadata: {},
          },
        ],
      },
      anthropic: {
        title: 'Anthropic',
        kind: 'builtin',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: '',
        models: [
          {
            modelName: 'claude-4-sonnet',
          },
        ],
        defaultAuthMethod: 'manual_api_key',
        experimental: false,
        authMethods: [
          {
            id: 'manual_api_key',
            type: 'api_key',
            label: 'Manually enter API Key',
            description: '',
            experimental: false,
            metadata: {},
          },
        ],
      },
    },
    customModels: [
      // {
      //   baseUrl: 'http://localhost:11434/v1',
      //   apiKey: '',
      //   modelName: 'qwen3',
      // },
    ],
    modelParameters: {
      maxSteps: 50,
      additionalInstruction: '',
    },
    ...props,
  };
}
