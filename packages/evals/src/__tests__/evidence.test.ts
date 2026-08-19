import {describe, expect, it} from '@jest/globals';
import {
  parseRunEvidence,
  RUN_EVIDENCE_SCHEMA_VERSION,
  serializeRunEvidence,
} from '../evidence';

describe('run evidence', () => {
  it('round-trips versioned evidence with unknown metadata preserved', () => {
    const input = {
      schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
      runId: 'run-1',
      scenario: {
        id: 'worksheet.create-chart-map',
        version: 1,
        repetition: 0,
      },
      target: {
        type: 'cli-in-process',
        profileName: 'worksheet-charts-maps',
        profileVersion: 1,
      },
      repository: {commitSha: 'abc123', dirty: false},
      model: {
        provider: 'openrouter',
        modelId: 'deepseek/deepseek-v4-flash-0731',
        settings: {temperature: 0},
      },
      timing: {
        startedAt: '2026-08-19T12:00:00.000Z',
        endedAt: '2026-08-19T12:00:01.000Z',
        latencyMs: 1000,
      },
      status: 'passed' as const,
      promptTurns: [{id: 'create', input: 'Create a worksheet.'}],
      finalAnswer: 'Created the worksheet.',
      events: [
        {
          sequence: 0,
          timestamp: '2026-08-19T12:00:00.500Z',
          type: 'mutation' as const,
          data: {artifactId: 'worksheet-1'},
          futureEventField: 'preserved',
        },
      ],
      finalState: {worksheetCount: 1},
      oracleResults: [
        {
          oracleId: 'workspace',
          kind: 'workspace-state' as const,
          pass: true,
          score: 1,
          reason: 'Worksheet exists.',
          evidence: {},
          metadata: {futureOracleMetadata: {value: 42}},
        },
      ],
      metadata: {futureRunnerMetadata: {traceId: 'trace-1'}},
      futureEnvelopeField: {retained: true},
    };

    const parsed = parseRunEvidence(serializeRunEvidence(input));

    expect(parsed.metadata).toEqual(input.metadata);
    expect(parsed.oracleResults[0]?.metadata).toEqual(
      input.oracleResults[0]?.metadata,
    );
    expect(parsed.events[0]).toHaveProperty('futureEventField', 'preserved');
    expect(parsed).toHaveProperty('futureEnvelopeField', {retained: true});
  });

  it('rejects unsupported evidence versions', () => {
    expect(() => parseRunEvidence({schemaVersion: 2})).toThrow();
  });
});
