import {describe, expect, it} from '@jest/globals';
import {RUN_EVIDENCE_SCHEMA_VERSION, type RunEvidence} from '../evidence';
import {
  toPromptfooAssertionResult,
  toPromptfooProviderResponse,
} from '../promptfoo';

const evidence: RunEvidence = {
  schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
  runId: 'run-1',
  scenario: {id: 'document.verify', version: 1, repetition: 0},
  target: {
    type: 'cli-in-process',
    profileName: 'document-charts-maps',
    profileVersion: 1,
  },
  model: {provider: 'scripted', modelId: 'scripted-v1', settings: {}},
  timing: {
    startedAt: '2026-08-19T12:00:00.000Z',
    endedAt: '2026-08-19T12:00:00.010Z',
    latencyMs: 10,
  },
  status: 'passed',
  promptTurns: [],
  finalAnswer: 'Done.',
  events: [],
  checkResults: [],
  metadata: {},
};

describe('Promptfoo boundary helpers', () => {
  it('puts validated evidence in provider metadata', () => {
    expect(toPromptfooProviderResponse(evidence)).toEqual({
      output: 'Done.',
      metadata: {sqlroomsEvidence: evidence},
    });
  });

  it('converts check results to one assertion result', () => {
    expect(
      toPromptfooAssertionResult([
        {
          checkId: 'workspace',
          kind: 'workspace-state',
          pass: true,
          score: 1,
          reason: 'Valid.',
          evidence: {},
          metadata: {},
        },
        {
          checkId: 'answer',
          kind: 'answer-grounding',
          pass: false,
          score: 0.25,
          reason: 'Missing source.',
          evidence: {},
          metadata: {},
        },
      ]),
    ).toEqual({
      pass: false,
      score: 0.625,
      reason: 'answer: Missing source.',
      namedScores: {workspace: 1, answer: 0.25},
    });
  });

  it('reports an empty result set as a failure', () => {
    expect(toPromptfooAssertionResult([])).toEqual({
      pass: false,
      score: 0,
      reason: 'No SQLRooms check results were produced.',
      namedScores: {},
    });
  });

  it('rejects duplicate check result IDs', () => {
    const result = {
      checkId: 'workspace',
      kind: 'workspace-state' as const,
      pass: true,
      score: 1,
      reason: 'Valid.',
      evidence: {},
      metadata: {},
    };

    expect(() => toPromptfooAssertionResult([result, result])).toThrow(
      'Duplicate check result IDs: workspace.',
    );
  });
});
