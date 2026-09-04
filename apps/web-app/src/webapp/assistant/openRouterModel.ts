import type {AssistantModelMode} from './modelModes';

const DEFAULT_OPENROUTER_MODELS = {
  fast: 'deepseek/deepseek-v4-flash',
  deep: 'deepseek/deepseek-v4-pro',
} satisfies Record<AssistantModelMode, string>;

type OpenRouterModelEnvironment = {
  OPENROUTER_MODEL?: string;
};

export function resolveOpenRouterModel(
  modelMode: AssistantModelMode = 'fast',
  environment: OpenRouterModelEnvironment = process.env,
) {
  if (modelMode === 'fast') {
    const configuredModel = environment.OPENROUTER_MODEL?.trim();
    if (configuredModel) return configuredModel;
  }
  return DEFAULT_OPENROUTER_MODELS[modelMode];
}
