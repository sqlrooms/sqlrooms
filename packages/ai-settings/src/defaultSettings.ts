import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';

export function createDefaultAiSettingsConfig(
  props?: Partial<AiSettingsSliceConfig>,
): AiSettingsSliceConfig {
  return {
    defaultProvider: 'openai',
    defaultModel: '',
    providers: {
      openai: {
        title: 'OpenAI',
        kind: 'builtin',
        configured: false,
        baseUrl: 'https://api.openai.com/v1',
        models: [],
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
        configured: false,
        baseUrl: 'https://api.anthropic.com/v1',
        models: [],
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
