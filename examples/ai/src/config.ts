import {AiSettingsSliceConfig, createDefaultAiSettings} from '@sqlrooms/ai';

export const DEFAULT_MODEL = 'gpt-4.1';

// Constants for commonly used values
export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';

// Default base URLs for each provider
export const PROVIDER_DEFAULT_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  deepseek: 'https://api.deepseek.com/v1',
  ollama: OLLAMA_DEFAULT_BASE_URL,
} as const;

export const LLM_MODELS = [
  {
    name: 'openai',
    models: [
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4.1',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4',
      'gpt-5',
    ],
  },
  {
    name: 'anthropic',
    models: ['claude-3-5-sonnet', 'claude-3-5-haiku'],
  },
  {
    name: 'google',
    models: [
      'gemini-2.0-pro-exp-02-05',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ],
  },
  {
    name: 'deepseek',
    models: ['deepseek-chat'],
  },
  {
    name: 'ollama',
    models: ['qwen3:32b', 'gpt-oss'],
  },
];

export const AI_SETTINGS = {
  providers: LLM_MODELS.reduce((acc: Record<string, unknown>, provider) => {
    acc[provider.name] = {
      baseUrl:
        PROVIDER_DEFAULT_BASE_URLS[
          provider.name as keyof typeof PROVIDER_DEFAULT_BASE_URLS
        ],
      apiKey: '',
      models: provider.models.map((model) => ({
        id: model,
        modelName: model,
      })),
    };
    return acc;
  }, {}) as AiSettingsSliceConfig['aiSettings']['providers'],
};

/**
 * Migrate room older versions of the example app config
 */
export function migrateRoomConfig(config: unknown) {
  if (typeof config !== 'object' || config === null) {
    return config;
  }
  let next = config;
  if (!('aiSettings' in config)) {
    next = {...config, ...createDefaultAiSettings(AI_SETTINGS)};
  }
  return next;
}
