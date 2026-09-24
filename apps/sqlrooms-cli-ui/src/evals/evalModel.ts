/** Local default; CI explicitly supplies the shared SQLROOMS_EVAL_MODEL variable. */
export const DEFAULT_OPENROUTER_EVAL_MODEL = 'deepseek/deepseek-v4-flash-0731';

/** Resolves the same OpenRouter model for the embedded and external targets. */
export function getOpenRouterEvalModel(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const model = (
    environment.SQLROOMS_EVAL_MODEL ?? DEFAULT_OPENROUTER_EVAL_MODEL
  ).trim();
  if (!model) throw new Error('SQLROOMS_EVAL_MODEL must be non-empty.');
  return model;
}
