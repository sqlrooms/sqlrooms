export const ASSISTANT_MODEL_PROVIDER = 'assistant';

export const ASSISTANT_MODEL_MODES = [
  {
    provider: ASSISTANT_MODEL_PROVIDER,
    label: 'Fast',
    value: 'fast',
  },
  {
    provider: ASSISTANT_MODEL_PROVIDER,
    label: 'Deep',
    value: 'deep',
  },
] as const;

export const DEFAULT_ASSISTANT_MODEL_MODE = 'fast';

export type AssistantModelMode =
  (typeof ASSISTANT_MODEL_MODES)[number]['value'];
