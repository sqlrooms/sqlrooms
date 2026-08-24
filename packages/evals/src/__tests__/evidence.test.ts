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
        id: 'document.create-chart-map',
        version: 1,
        repetition: 0,
        futureScenarioField: 'preserved',
      },
      target: {
        type: 'cli-in-process',
        profileName: 'document-charts-maps',
        profileVersion: 1,
        futureTargetField: 'preserved',
      },
      repository: {
        commitSha: 'abc123',
        dirty: false,
        futureRepositoryField: 'preserved',
      },
      model: {
        provider: 'openrouter',
        modelId: 'deepseek/deepseek-v4-flash-0731',
        settings: {temperature: 0},
        futureModelField: 'preserved',
      },
      timing: {
        startedAt: '2026-08-19T12:00:00.000Z',
        endedAt: '2026-08-19T12:00:01.000Z',
        latencyMs: 1000,
        futureTimingField: 'preserved',
      },
      status: 'passed' as const,
      promptTurns: [
        {
          id: 'create',
          input: 'Create a document.',
          futurePromptField: 'preserved',
        },
      ],
      finalAnswer: 'Created the document.',
      events: [
        {
          sequence: 0,
          timestamp: '2026-08-19T12:00:00.500Z',
          type: 'mutation' as const,
          data: {artifactId: 'document-1'},
          futureEventField: 'preserved',
        },
      ],
      usage: {
        totalTokens: 10,
        futureUsageField: 'preserved',
      },
      finalState: {documentCount: 1},
      oracleResults: [
        {
          oracleId: 'workspace',
          kind: 'workspace-state' as const,
          pass: true,
          score: 1,
          reason: 'Document exists.',
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
    expect(parsed.scenario).toHaveProperty('futureScenarioField', 'preserved');
    expect(parsed.target).toHaveProperty('futureTargetField', 'preserved');
    expect(parsed.repository).toHaveProperty(
      'futureRepositoryField',
      'preserved',
    );
    expect(parsed.model).toHaveProperty('futureModelField', 'preserved');
    expect(parsed.timing).toHaveProperty('futureTimingField', 'preserved');
    expect(parsed.promptTurns[0]).toHaveProperty(
      'futurePromptField',
      'preserved',
    );
    expect(parsed.usage).toHaveProperty('futureUsageField', 'preserved');
    expect(parsed).toHaveProperty('futureEnvelopeField', {retained: true});
  });

  it('rejects unsupported evidence versions', () => {
    expect(() => parseRunEvidence({schemaVersion: 2})).toThrow();
  });

  it.each([
    ['duplicate', [0, 0]],
    ['descending', [1, 0]],
  ])('rejects %s event sequence values', (_name, sequences) => {
    expect(() =>
      parseRunEvidence({
        schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
        runId: 'run-ordering',
        scenario: {id: 'document.ordering', version: 1, repetition: 0},
        target: {
          type: 'cli-in-process',
          profileName: 'document-charts-maps',
          profileVersion: 1,
        },
        model: {provider: 'scripted', modelId: 'scripted-v1'},
        timing: {
          startedAt: '2026-08-19T12:00:00.000Z',
          endedAt: '2026-08-19T12:00:00.010Z',
          latencyMs: 10,
        },
        status: 'passed',
        promptTurns: [],
        finalAnswer: 'Done.',
        events: sequences.map((sequence) => ({
          sequence,
          timestamp: '2026-08-19T12:00:00.005Z',
          type: 'tool',
        })),
        oracleResults: [],
      }),
    ).toThrow('Event sequence values must be strictly increasing.');
  });

  it.each([
    ['bigint', BigInt(1)],
    ['undefined', undefined],
    ['function', () => 1],
    ['symbol', Symbol('future')],
  ])('rejects a non-JSON %s extension value', (_name, value) => {
    expect(() =>
      parseRunEvidence({
        schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
        runId: 'run-json-extension',
        scenario: {id: 'document.json-extension', version: 1, repetition: 0},
        target: {
          type: 'cli-in-process',
          profileName: 'document-charts-maps',
          profileVersion: 1,
        },
        model: {provider: 'scripted', modelId: 'scripted-v1'},
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
        futureEnvelopeField: value,
      }),
    ).toThrow();
  });

  it('allocates fresh object defaults for every evidence record', () => {
    const input = {
      schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
      runId: 'run-defaults',
      scenario: {
        id: 'document.defaults',
        version: 1,
        repetition: 0,
      },
      target: {
        type: 'cli-in-process',
        profileName: 'document-charts-maps',
        profileVersion: 1,
      },
      model: {
        provider: 'scripted',
        modelId: 'scripted-v1',
      },
      timing: {
        startedAt: '2026-08-19T12:00:00.000Z',
        endedAt: '2026-08-19T12:00:00.010Z',
        latencyMs: 10,
      },
      status: 'passed',
      promptTurns: [],
      finalAnswer: 'Done.',
      events: [
        {
          sequence: 0,
          timestamp: '2026-08-19T12:00:00.005Z',
          type: 'tool',
        },
      ],
      oracleResults: [
        {
          oracleId: 'workspace',
          kind: 'workspace-state',
          pass: true,
          score: 1,
          reason: 'Workspace is valid.',
        },
      ],
    };

    const first = parseRunEvidence(input);
    const second = parseRunEvidence(input);

    expect(first.metadata).not.toBe(second.metadata);
    expect(first.model.settings).not.toBe(second.model.settings);
    expect(first.events[0]?.data).not.toBe(second.events[0]?.data);
    expect(first.oracleResults[0]?.evidence).not.toBe(
      second.oracleResults[0]?.evidence,
    );
    expect(first.oracleResults[0]?.metadata).not.toBe(
      second.oracleResults[0]?.metadata,
    );
  });
});
