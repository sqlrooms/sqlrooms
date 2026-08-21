import {z} from 'zod';
import {JsonObjectSchema} from './json';

/** Stable scenario identifier format used in run history. */
export const ScenarioIdSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/,
    'Scenario IDs must be lowercase dot- or dash-separated identifiers.',
  );

/** One user turn in an evaluator-neutral behavioral scenario. */
export const ScenarioTurnSchema = z.object({
  id: z.string().min(1),
  input: z.string().min(1),
});

/** An outcome contract evaluated after a scenario run. */
export const ScenarioExpectationSchema = z.object({
  oracleId: z.string().min(1),
  description: z.string().min(1),
  config: JsonObjectSchema.default(() => ({})),
});

/** Versioned, evaluator-neutral behavioral scenario definition. */
export const ScenarioDefinitionSchema = z.looseObject({
  id: ScenarioIdSchema,
  version: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  compatibleProfiles: z.array(z.string().min(1)).min(1),
  fixture: JsonObjectSchema.default(() => ({})),
  turns: z.array(ScenarioTurnSchema).min(1),
  expectations: z.array(ScenarioExpectationSchema).min(1),
  metadata: JsonObjectSchema.default(() => ({})),
});

/** A parsed behavioral scenario. */
export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;

/** Parses and validates a behavioral scenario definition. */
export function defineScenario(input: unknown): ScenarioDefinition {
  return ScenarioDefinitionSchema.parse(input);
}
