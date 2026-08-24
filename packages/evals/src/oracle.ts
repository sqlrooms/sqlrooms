import {z} from 'zod';
import type {JsonObject, JsonValue} from './json.js';
import {JsonObjectSchema, JsonValueSchema} from './json.js';
import type {ScenarioDefinition} from './scenario.js';

/** Supported evaluator-neutral oracle categories. */
export const OracleKindSchema = z.enum([
  'database',
  'workspace-state',
  'answer-grounding',
  'error',
  'policy',
]);

/** Structured result produced by one behavioral oracle. */
export const OracleResultSchema = z
  .looseObject({
    oracleId: z.string().min(1),
    kind: OracleKindSchema,
    pass: z.boolean(),
    score: z.number().min(0).max(1),
    reason: z.string().min(1),
    evidence: JsonObjectSchema.default(() => ({})),
    metadata: JsonObjectSchema.default(() => ({})),
  })
  .catchall(JsonValueSchema);

/** Structured result produced by one behavioral oracle. */
export type OracleResult = z.infer<typeof OracleResultSchema>;

/** Error observed during a behavioral run. */
export type ObservedError = {
  name?: string;
  message: string;
  code?: string;
  metadata?: JsonObject;
};

/** Durable mutation observed during a behavioral run. */
export type ObservedMutation = {
  kind: string;
  targetId?: string;
  data?: JsonObject;
};

/** Target-neutral material available to behavioral oracles. */
export type OracleContext = {
  scenario: ScenarioDefinition;
  database?: JsonValue;
  workspace?: JsonValue;
  finalAnswer: string;
  errors: readonly ObservedError[];
  mutations: readonly ObservedMutation[];
  metadata: JsonObject;
};

/** Unnormalized outcome returned by an oracle implementation. */
export type OracleEvaluation = {
  pass: boolean;
  score?: number;
  reason: string;
  evidence?: JsonObject;
  metadata?: JsonObject;
};

/** An evaluator-neutral oracle. */
export type BehavioralOracle = {
  readonly id: string;
  readonly kind: z.infer<typeof OracleKindSchema>;
  evaluate(
    context: OracleContext,
  ): OracleEvaluation | Promise<OracleEvaluation>;
};

/** Definition for an oracle over one selected part of the run context. */
export type OracleOptions<TValue> = {
  id: string;
  evaluate(
    value: TValue,
    context: OracleContext,
  ): OracleEvaluation | Promise<OracleEvaluation>;
};

function createSpecializedOracle<TValue>(
  kind: BehavioralOracle['kind'],
  options: OracleOptions<TValue>,
  select: (context: OracleContext) => TValue,
): BehavioralOracle {
  return {
    id: options.id,
    kind,
    evaluate: (context) => options.evaluate(select(context), context),
  };
}

/** Creates an oracle over the final database snapshot. */
export function createDatabaseOracle(
  options: OracleOptions<JsonValue | undefined>,
): BehavioralOracle {
  return createSpecializedOracle(
    'database',
    options,
    (context) => context.database,
  );
}

/** Creates an oracle over the final durable workspace state. */
export function createWorkspaceStateOracle(
  options: OracleOptions<JsonValue | undefined>,
): BehavioralOracle {
  return createSpecializedOracle(
    'workspace-state',
    options,
    (context) => context.workspace,
  );
}

/** Creates an oracle over the assistant's final answer and grounding context. */
export function createAnswerGroundingOracle(
  options: OracleOptions<string>,
): BehavioralOracle {
  return createSpecializedOracle(
    'answer-grounding',
    options,
    (context) => context.finalAnswer,
  );
}

/** Creates an oracle over errors observed during the run. */
export function createErrorOracle(
  options: OracleOptions<readonly ObservedError[]>,
): BehavioralOracle {
  return createSpecializedOracle('error', options, (context) => context.errors);
}

/** Creates an oracle over mutations for enforcing read/write policies. */
export function createPolicyOracle(
  options: OracleOptions<readonly ObservedMutation[]>,
): BehavioralOracle {
  return createSpecializedOracle(
    'policy',
    options,
    (context) => context.mutations,
  );
}

/**
 * Evaluates oracles in declaration order and normalizes their results.
 *
 * @throws When oracle IDs are duplicated or a scenario expectation has no
 * matching oracle implementation.
 */
export async function evaluateOracles(
  oracles: readonly BehavioralOracle[],
  context: OracleContext,
): Promise<OracleResult[]> {
  const duplicateOracleIds = Array.from(
    new Set(
      oracles
        .map((oracle) => oracle.id)
        .filter(
          (oracleId, index, oracleIds) => oracleIds.indexOf(oracleId) !== index,
        ),
    ),
  );
  if (duplicateOracleIds.length > 0) {
    throw new Error(
      `Duplicate oracle implementations: ${duplicateOracleIds.join(', ')}.`,
    );
  }

  const availableOracleIds = new Set(oracles.map((oracle) => oracle.id));
  const missingOracleIds = Array.from(
    new Set(
      context.scenario.expectations
        .map((expectation) => expectation.oracleId)
        .filter((oracleId) => !availableOracleIds.has(oracleId)),
    ),
  );
  if (missingOracleIds.length > 0) {
    throw new Error(
      `Missing required oracle implementations: ${missingOracleIds.join(', ')}.`,
    );
  }

  const results: OracleResult[] = [];
  for (const oracle of oracles) {
    const evaluation = await oracle.evaluate(context);
    results.push(
      OracleResultSchema.parse({
        oracleId: oracle.id,
        kind: oracle.kind,
        pass: evaluation.pass,
        score: evaluation.score ?? (evaluation.pass ? 1 : 0),
        reason: evaluation.reason,
        evidence: evaluation.evidence ?? {},
        metadata: evaluation.metadata ?? {},
      }),
    );
  }
  return results;
}

/** Aggregate status and mean score for a set of oracle results. */
export function summarizeOracleResults(results: readonly OracleResult[]): {
  pass: boolean;
  score: number;
} {
  return {
    pass: results.length > 0 && results.every((result) => result.pass),
    score:
      results.length === 0
        ? 0
        : results.reduce((sum, result) => sum + result.score, 0) /
          results.length,
  };
}
