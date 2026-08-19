import type {OracleResult} from '../oracle';
import {OracleResultSchema, summarizeOracleResults} from '../oracle';
import type {RunEvidence} from '../evidence';
import {RunEvidenceSchema} from '../evidence';

export * from './readModel';
export * from './calibration';
export * from './sqlite';

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
 * Converts oracle results into one Promptfoo assertion result.
 *
 * @throws When multiple results use the same oracle ID.
 */
export function toPromptfooAssertionResult(
  results: readonly OracleResult[],
): PromptfooAssertionResult {
  const parsedResults = results.map((result) =>
    OracleResultSchema.parse(result),
  );
  const duplicateOracleIds = Array.from(
    new Set(
      parsedResults
        .map((result) => result.oracleId)
        .filter(
          (oracleId, index, oracleIds) => oracleIds.indexOf(oracleId) !== index,
        ),
    ),
  );
  if (duplicateOracleIds.length > 0) {
    throw new Error(
      `Duplicate oracle result IDs: ${duplicateOracleIds.join(', ')}.`,
    );
  }

  const summary = summarizeOracleResults(parsedResults);
  const failures = parsedResults.filter((result) => !result.pass);
  return {
    ...summary,
    reason:
      parsedResults.length === 0
        ? 'No SQLRooms oracle results were produced.'
        : failures.length === 0
          ? `${parsedResults.length} SQLRooms oracle${parsedResults.length === 1 ? '' : 's'} passed.`
          : failures
              .map((result) => `${result.oracleId}: ${result.reason}`)
              .join('; '),
    namedScores: Object.fromEntries(
      parsedResults.map((result) => [result.oracleId, result.score]),
    ),
  };
}
