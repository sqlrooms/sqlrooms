import {describe, expect, it} from '@jest/globals';
import {
  createAnswerGroundingCheck,
  createDatabaseCheck,
  createErrorCheck,
  createPolicyCheck,
  createWorkspaceStateCheck,
  evaluateBehavioralChecks,
  summarizeBehavioralCheckResults,
  type BehavioralCheckContext,
} from '../behavioralCheck';
import {defineScenario} from '../scenario';

const scenario = defineScenario({
  id: 'document.verify-outcomes',
  version: 1,
  title: 'Verify outcomes',
  compatibleProfiles: ['document-charts-maps'],
  turns: [{id: 'verify', input: 'Verify the result.'}],
  expectations: [{checkId: 'database', description: 'Database is grounded.'}],
});

const context: BehavioralCheckContext = {
  scenario,
  database: {canonicalTable: 'analytics.events'},
  workspace: {documentCount: 1},
  finalAnswer: 'Created one document from analytics.events.',
  errors: [],
  mutations: [{kind: 'document.create', targetId: 'document-1'}],
  metadata: {},
};

describe('behavioral checks', () => {
  it('rejects an empty check ID at creation', () => {
    expect(() =>
      createDatabaseCheck({
        id: '',
        evaluate: () => ({pass: true, reason: 'Database is valid.'}),
      }),
    ).toThrow('Behavioral check ID must not be empty.');
  });

  it('composes database, workspace, answer, error, and policy checks', async () => {
    const results = await evaluateBehavioralChecks(
      [
        createDatabaseCheck({
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
        createWorkspaceStateCheck({
          id: 'workspace',
          evaluate: (workspace) => ({
            pass: workspace !== undefined,
            reason: 'Workspace snapshot exists.',
          }),
        }),
        createAnswerGroundingCheck({
          id: 'answer',
          evaluate: (answer) => ({
            pass: answer.includes('analytics.events'),
            score: 0.8,
            reason: 'Answer names the selected table.',
          }),
        }),
        createErrorCheck({
          id: 'errors',
          evaluate: (errors) => ({
            pass: errors.length === 0,
            reason: 'No errors observed.',
          }),
        }),
        createPolicyCheck({
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
    expect(summarizeBehavioralCheckResults(results)).toEqual({
      pass: true,
      score: 0.96,
    });
  });

  it('keeps failure reasons and structured evidence', async () => {
    const [result] = await evaluateBehavioralChecks(
      [
        createPolicyCheck({
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
              checkId: 'read-only',
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

  it('does not pass when no check results were produced', () => {
    expect(summarizeBehavioralCheckResults([])).toEqual({
      pass: false,
      score: 0,
    });
  });

  it('rejects a passing subset when required checks are missing', async () => {
    const scenarioWithMultipleExpectations = defineScenario({
      ...scenario,
      expectations: [
        ...scenario.expectations,
        {
          checkId: 'workspace',
          description: 'Workspace state is valid.',
        },
      ],
    });

    await expect(
      evaluateBehavioralChecks(
        [
          createDatabaseCheck({
            id: 'database',
            evaluate: () => ({pass: true, reason: 'Database is valid.'}),
          }),
        ],
        {...context, scenario: scenarioWithMultipleExpectations},
      ),
    ).rejects.toThrow('Missing required check implementations: workspace.');
  });

  it('rejects duplicate check implementations', async () => {
    const duplicateCheck = createDatabaseCheck({
      id: 'database',
      evaluate: () => ({pass: true, reason: 'Database is valid.'}),
    });

    await expect(
      evaluateBehavioralChecks([duplicateCheck, duplicateCheck], context),
    ).rejects.toThrow('Duplicate check implementations: database.');
  });
});
