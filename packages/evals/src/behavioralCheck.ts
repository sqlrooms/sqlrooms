import {z} from 'zod';
import type {JsonObject, JsonValue} from './json.js';
import {JsonObjectSchema, JsonValueSchema} from './json.js';
import type {ScenarioDefinition} from './scenario.js';

/** Supported evaluator-neutral behavioral check categories. */
export const BehavioralCheckKindSchema = z.enum([
  'database',
  'workspace-state',
  'answer-grounding',
  'error',
  'policy',
]);

/** Structured result produced by one behavioral check. */
export const BehavioralCheckResultSchema = z
  .looseObject({
    checkId: z.string().min(1),
    kind: BehavioralCheckKindSchema,
    pass: z.boolean(),
    score: z.number().min(0).max(1),
    reason: z.string().min(1),
    evidence: JsonObjectSchema.default(() => ({})),
    metadata: JsonObjectSchema.default(() => ({})),
  })
  .catchall(JsonValueSchema);

/** Structured result produced by one behavioral check. */
export type BehavioralCheckResult = z.infer<typeof BehavioralCheckResultSchema>;

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

/** Target-neutral material available to behavioral checks. */
export type BehavioralCheckContext = {
  scenario: ScenarioDefinition;
  database?: JsonValue;
  workspace?: JsonValue;
  finalAnswer: string;
  errors: readonly ObservedError[];
  mutations: readonly ObservedMutation[];
  metadata: JsonObject;
};

/** Unnormalized outcome returned by a behavioral check implementation. */
export type BehavioralCheckEvaluation = {
  pass: boolean;
  score?: number;
  reason: string;
  evidence?: JsonObject;
  metadata?: JsonObject;
};

/** An evaluator-neutral behavioral check. */
export type BehavioralCheck = {
  readonly id: string;
  readonly kind: z.infer<typeof BehavioralCheckKindSchema>;
  evaluate(
    context: BehavioralCheckContext,
  ): BehavioralCheckEvaluation | Promise<BehavioralCheckEvaluation>;
};

/** Definition for a behavioral check over one part of the run context. */
export type BehavioralCheckOptions<TValue> = {
  id: string;
  evaluate(
    value: TValue,
    context: BehavioralCheckContext,
  ): BehavioralCheckEvaluation | Promise<BehavioralCheckEvaluation>;
};

function createSpecializedCheck<TValue>(
  kind: BehavioralCheck['kind'],
  options: BehavioralCheckOptions<TValue>,
  select: (context: BehavioralCheckContext) => TValue,
): BehavioralCheck {
  if (options.id.length === 0) {
    throw new Error('Behavioral check ID must not be empty.');
  }

  return {
    id: options.id,
    kind,
    evaluate: (context) => options.evaluate(select(context), context),
  };
}

/** Creates a check over the final database snapshot. */
export function createDatabaseCheck(
  options: BehavioralCheckOptions<JsonValue | undefined>,
): BehavioralCheck {
  return createSpecializedCheck(
    'database',
    options,
    (context) => context.database,
  );
}

/** Creates a check over the final durable workspace state. */
export function createWorkspaceStateCheck(
  options: BehavioralCheckOptions<JsonValue | undefined>,
): BehavioralCheck {
  return createSpecializedCheck(
    'workspace-state',
    options,
    (context) => context.workspace,
  );
}

/** Creates a check over the assistant's final answer and grounding context. */
export function createAnswerGroundingCheck(
  options: BehavioralCheckOptions<string>,
): BehavioralCheck {
  return createSpecializedCheck(
    'answer-grounding',
    options,
    (context) => context.finalAnswer,
  );
}

/** Creates a check over errors observed during the run. */
export function createErrorCheck(
  options: BehavioralCheckOptions<readonly ObservedError[]>,
): BehavioralCheck {
  return createSpecializedCheck('error', options, (context) => context.errors);
}

/** Creates a check over mutations for enforcing read/write policies. */
export function createPolicyCheck(
  options: BehavioralCheckOptions<readonly ObservedMutation[]>,
): BehavioralCheck {
  return createSpecializedCheck(
    'policy',
    options,
    (context) => context.mutations,
  );
}

/**
 * Evaluates checks in declaration order and normalizes their results.
 *
 * @throws When check IDs are duplicated or a scenario expectation has no
 * matching check implementation.
 */
export async function evaluateBehavioralChecks(
  checks: readonly BehavioralCheck[],
  context: BehavioralCheckContext,
): Promise<BehavioralCheckResult[]> {
  const duplicateCheckIds = Array.from(
    new Set(
      checks
        .map((check) => check.id)
        .filter(
          (checkId, index, checkIds) => checkIds.indexOf(checkId) !== index,
        ),
    ),
  );
  if (duplicateCheckIds.length > 0) {
    throw new Error(
      `Duplicate check implementations: ${duplicateCheckIds.join(', ')}.`,
    );
  }

  const availableCheckIds = new Set(checks.map((check) => check.id));
  const missingCheckIds = Array.from(
    new Set(
      context.scenario.expectations
        .map((expectation) => expectation.checkId)
        .filter((checkId) => !availableCheckIds.has(checkId)),
    ),
  );
  if (missingCheckIds.length > 0) {
    throw new Error(
      `Missing required check implementations: ${missingCheckIds.join(', ')}.`,
    );
  }

  const results: BehavioralCheckResult[] = [];
  for (const check of checks) {
    const evaluation = await check.evaluate(context);
    results.push(
      BehavioralCheckResultSchema.parse({
        checkId: check.id,
        kind: check.kind,
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

/** Aggregate status and mean score for a set of check results. */
export function summarizeBehavioralCheckResults(
  results: readonly BehavioralCheckResult[],
): {
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
