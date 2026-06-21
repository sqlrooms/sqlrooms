import {z} from 'zod';

type AgentIntentInput = {
  intent?: string;
  prompt?: string;
};

export const AgentIntentSchemaFields = {
  intent: z
    .string()
    .optional()
    .describe('The natural-language objective for the agent to satisfy.'),
  prompt: z
    .string()
    .optional()
    .describe('Deprecated alias for intent. Use intent for new callers.'),
};

export function requireAgentIntent(
  value: AgentIntentInput,
  ctx: z.RefinementCtx,
) {
  if (resolveAgentIntent(value)) return;
  ctx.addIssue({
    code: 'custom',
    path: ['intent'],
    message: 'intent is required. prompt is accepted as a deprecated alias.',
  });
}

export function resolveAgentIntent(value: AgentIntentInput) {
  return value.intent?.trim() || value.prompt?.trim();
}
