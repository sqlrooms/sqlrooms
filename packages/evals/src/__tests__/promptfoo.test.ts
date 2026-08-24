import {describe, expect, it} from '@jest/globals';
import type {RunEvidence} from '../evidence';
import {
  toPromptfooAssertionResult,
  toPromptfooProviderResponse,
} from '../promptfoo';

const evidence: RunEvidence = {
  schemaVersion: 1,
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
  oracleResults: [],
  metadata: {},
};

describe('Promptfoo boundary helpers', () => {
  it('puts validated evidence in provider metadata', () => {
    expect(toPromptfooProviderResponse(evidence)).toEqual({
      output: 'Done.',
      metadata: {sqlroomsEvidence: evidence},
    });
  });

  it('converts oracle results to one assertion result', () => {
    expect(
      toPromptfooAssertionResult([
        {
          oracleId: 'workspace',
          kind: 'workspace-state',
          pass: true,
          score: 1,
          reason: 'Valid.',
          evidence: {},
          metadata: {},
        },
        {
          oracleId: 'answer',
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
      reason: 'No SQLRooms oracle results were produced.',
      namedScores: {},
    });
  });

  it('rejects duplicate oracle result IDs', () => {
    const result = {
      oracleId: 'workspace',
      kind: 'workspace-state' as const,
      pass: true,
      score: 1,
      reason: 'Valid.',
      evidence: {},
      metadata: {},
    };

    expect(() => toPromptfooAssertionResult([result, result])).toThrow(
      'Duplicate oracle result IDs: workspace.',
    );
  });
});
