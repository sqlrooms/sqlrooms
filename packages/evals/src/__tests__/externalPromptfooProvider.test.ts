import {describe, expect, it} from '@jest/globals';
import {RUN_EVIDENCE_SCHEMA_VERSION, RunEvidenceSchema} from '../evidence';
import {createExternalPromptfooProvider} from '../external/promptfooProvider';

const evidence = (status: 'passed' | 'error') =>
  RunEvidenceSchema.parse({
    schemaVersion: RUN_EVIDENCE_SCHEMA_VERSION,
    runId: 'demo-1',
    scenario: {id: 'demo', version: 1, repetition: 0},
    target: {type: 'demo-external', profileName: 'demo', profileVersion: 1},
    model: {provider: 'stub', modelId: 'none', settings: {}},
    timing: {
      startedAt: new Date(0).toISOString(),
      endedAt: new Date(1).toISOString(),
      latencyMs: 1,
    },
    status,
    promptTurns: [{id: 'prompt', input: 'Go.'}],
    finalAnswer: 'Done.',
    finalState: {},
    events:
      status === 'error'
        ? [
            {
              sequence: 0,
              timestamp: new Date(0).toISOString(),
              type: 'error',
              name: 'Error',
              data: {message: 'HTTP 429 Too Many Requests'},
            },
          ]
        : [],
    checkResults: [],
    metadata: {failureKind: status === 'error' ? 'harness' : null},
  });

describe('createExternalPromptfooProvider', () => {
  it('forwards the abort signal and keeps the evidence envelope', async () => {
    let received: AbortSignal | undefined;
    const Provider = createExternalPromptfooProvider({
      id: 'demo',
      run: async ({signal}) => {
        received = signal;
        return evidence('passed');
      },
      metadata: () => ({sqlroomsEvidence: null, extra: 1}),
    });
    const controller = new AbortController();
    const response = await Provider().callApi(
      'Go.',
      {vars: {}},
      {abortSignal: controller.signal},
    );
    expect(received).toBe(controller.signal);
    expect(response.metadata.extra).toBe(1);
    expect(response.metadata.sqlroomsEvidence).toMatchObject({runId: 'demo-1'});
    expect(response.error).toBeUndefined();
  });

  it('reports a failed run without retry-triggering details', async () => {
    const Provider = createExternalPromptfooProvider({
      id: 'demo',
      run: async () => evidence('error'),
    });
    const response = await Provider().callApi('Go.');
    expect(response.error).toBe(
      'External run error (harness); see sqlroomsEvidence for details.',
    );
    expect(response.error).not.toMatch(/429/);
  });
});
