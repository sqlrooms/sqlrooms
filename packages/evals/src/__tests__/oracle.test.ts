import {describe, expect, it} from '@jest/globals';
import {
  createAnswerGroundingOracle,
  createDatabaseOracle,
  createErrorOracle,
  createPolicyOracle,
  createWorkspaceStateOracle,
  evaluateOracles,
  summarizeOracleResults,
  type OracleContext,
} from '../oracle';
import {defineScenario} from '../scenario';

const scenario = defineScenario({
  id: 'worksheet.verify-outcomes',
  version: 1,
  title: 'Verify outcomes',
  compatibleProfiles: ['worksheet-charts-maps'],
  turns: [{id: 'verify', input: 'Verify the result.'}],
  expectations: [{oracleId: 'database', description: 'Database is grounded.'}],
});

const context: OracleContext = {
  scenario,
  database: {canonicalTable: 'analytics.events'},
  workspace: {worksheetCount: 1},
  finalAnswer: 'Created one worksheet from analytics.events.',
  errors: [],
  mutations: [{kind: 'worksheet.create', targetId: 'worksheet-1'}],
  metadata: {},
};

describe('behavioral oracles', () => {
  it('composes database, workspace, answer, error, and policy checks', async () => {
    const results = await evaluateOracles(
      [
        createDatabaseOracle({
          id: 'database',
          evaluate: (database) => ({
            pass:
              typeof database === 'object' &&
              database !== null &&
              !Array.isArray(database) &&
              database.canonicalTable === 'analytics.events',
            reason: 'Canonical table matched.',
          }),
        }),
        createWorkspaceStateOracle({
          id: 'workspace',
          evaluate: (workspace) => ({
            pass: workspace !== undefined,
            reason: 'Workspace snapshot exists.',
          }),
        }),
        createAnswerGroundingOracle({
          id: 'answer',
          evaluate: (answer) => ({
            pass: answer.includes('analytics.events'),
            score: 0.8,
            reason: 'Answer names the selected table.',
          }),
        }),
        createErrorOracle({
          id: 'errors',
          evaluate: (errors) => ({
            pass: errors.length === 0,
            reason: 'No errors observed.',
          }),
        }),
        createPolicyOracle({
          id: 'policy',
          evaluate: (mutations) => ({
            pass: mutations.length === 1,
            reason: 'Only the intended mutation occurred.',
            evidence: {mutationCount: mutations.length},
          }),
        }),
      ],
      context,
    );

    expect(results).toHaveLength(5);
    expect(results.every((result) => result.pass)).toBe(true);
    expect(summarizeOracleResults(results)).toEqual({pass: true, score: 0.96});
  });

  it('keeps failure reasons and structured evidence', async () => {
    const [result] = await evaluateOracles(
      [
        createPolicyOracle({
          id: 'read-only',
          evaluate: (mutations) => ({
            pass: mutations.length === 0,
            reason: 'Read-only scenario mutated workspace state.',
            evidence: {mutations: mutations.length},
          }),
        }),
      ],
      {
        ...context,
        scenario: defineScenario({
          ...scenario,
          expectations: [
            {
              oracleId: 'read-only',
              description: 'Workspace remains read-only.',
            },
          ],
        }),
      },
    );

    expect(result).toMatchObject({
      pass: false,
      score: 0,
      reason: 'Read-only scenario mutated workspace state.',
      evidence: {mutations: 1},
    });
  });

  it('does not pass when no oracle results were produced', () => {
    expect(summarizeOracleResults([])).toEqual({pass: false, score: 0});
  });

  it('rejects a passing subset when required oracles are missing', async () => {
    const scenarioWithMultipleExpectations = defineScenario({
      ...scenario,
      expectations: [
        ...scenario.expectations,
        {
          oracleId: 'workspace',
          description: 'Workspace state is valid.',
        },
      ],
    });

    await expect(
      evaluateOracles(
        [
          createDatabaseOracle({
            id: 'database',
            evaluate: () => ({pass: true, reason: 'Database is valid.'}),
          }),
        ],
        {...context, scenario: scenarioWithMultipleExpectations},
      ),
    ).rejects.toThrow('Missing required oracle implementations: workspace.');
  });
});
