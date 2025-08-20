export const DEFAULT_MODEL = 'gpt-4o-mini';

// Constants for commonly used values
export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/api';
export const CUSTOM_MODEL_NAME = 'custom';

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
    models: ['qwen3:32b', 'qwen3', CUSTOM_MODEL_NAME],
  },
];
