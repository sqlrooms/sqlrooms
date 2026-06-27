import {z} from 'zod';

export const AgentIntentSchemaFields = {
  intent: z
    .string()
    .min(1, 'intent cannot be empty')
    .describe('The natural-language objective for the agent to satisfy.'),
};
