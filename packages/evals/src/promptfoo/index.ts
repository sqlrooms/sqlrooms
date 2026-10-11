import type {BehavioralCheckResult} from '../behavioralCheck.js';
import {
  BehavioralCheckResultSchema,
  summarizeBehavioralCheckResults,
} from '../behavioralCheck.js';
import type {RunEvidence} from '../evidence.js';
import {RunEvidenceSchema} from '../evidence.js';

export * from './readModel.js';
export * from './calibration.js';
export * from './markdown.js';
export * from './sqlite.js';

/** Promptfoo-compatible provider response without a Promptfoo dependency. */
export type PromptfooProviderResponse = {
  output: string;
  metadata: Record<string, unknown>;
};

/** Promptfoo-compatible assertion result without a Promptfoo dependency. */
export type PromptfooAssertionResult = {
  pass: boolean;
  score: number;
  reason: string;
  namedScores: Record<string, number>;
};

/** Stores validated SQLRooms evidence in Promptfoo provider metadata. */
export function toPromptfooProviderResponse(
  evidence: RunEvidence,
): PromptfooProviderResponse {
  const parsed = RunEvidenceSchema.parse(evidence);
  return {
    output: parsed.finalAnswer,
    metadata: {sqlroomsEvidence: parsed},
  };
}

/**
 * Converts check results into one Promptfoo assertion result.
 *
 * @throws When multiple results use the same check ID.
 */
export function toPromptfooAssertionResult(
  results: readonly BehavioralCheckResult[],
): PromptfooAssertionResult {
  const parsedResults = results.map((result) =>
    BehavioralCheckResultSchema.parse(result),
  );
  const duplicateCheckIds = Array.from(
    new Set(
      parsedResults
        .map((result) => result.checkId)
        .filter(
          (checkId, index, checkIds) => checkIds.indexOf(checkId) !== index,
        ),
    ),
  );
  if (duplicateCheckIds.length > 0) {
    throw new Error(
      `Duplicate check result IDs: ${duplicateCheckIds.join(', ')}.`,
    );
  }

  const summary = summarizeBehavioralCheckResults(parsedResults);
  const failures = parsedResults.filter((result) => !result.pass);
  return {
    ...summary,
    reason:
      parsedResults.length === 0
        ? 'No SQLRooms check results were produced.'
        : failures.length === 0
          ? `${parsedResults.length} SQLRooms check${parsedResults.length === 1 ? '' : 's'} passed.`
          : failures
              .map((result) => `${result.checkId}: ${result.reason}`)
              .join('; '),
    namedScores: Object.fromEntries(
      parsedResults.map((result) => [result.checkId, result.score]),
    ),
  };
}
