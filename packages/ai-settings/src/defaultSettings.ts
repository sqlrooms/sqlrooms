import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';

export function createDefaultAiSettingsConfig(
  props?: Partial<AiSettingsSliceConfig>,
): AiSettingsSliceConfig {
  return {
    providers: {
      openai: {
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
      },
      anthropic: {
        baseUrl: 'https://api.anthropic.com',
        apiKey: '',
        models: [
          {
            modelName: 'claude-4-sonnet',
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
