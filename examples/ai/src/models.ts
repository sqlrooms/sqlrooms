export const DEFAULT_MODEL = 'gpt-4o-mini';

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
];
