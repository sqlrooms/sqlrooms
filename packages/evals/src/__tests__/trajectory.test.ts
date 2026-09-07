import {describe, expect, it} from '@jest/globals';
import type {ObservatoryRun} from '../promptfoo/readModel';
import {createObservatoryTrajectory} from '../promptfoo/trajectory';

function run(events: ObservatoryRun['events']): ObservatoryRun {
  return {
    id: 'run-1',
    evalId: 'eval-1',
    createdAt: '2026-08-19T12:00:00.000Z',
    scenario: {id: 'document.create-chart-map', version: 1, repetition: 0},
    profile: {name: 'document-charts-maps', version: 1},
    repository: {commitSha: 'abc123'},
    model: {provider: 'openrouter', modelId: 'deepseek'},
    status: 'failed',
    counts: {tools: 1, nestedAgents: 1, errors: 0},
    promptTurns: [{id: 'create', input: 'Create a document.'}],
    answer: 'Done.',
    checkResults: [
      {
        checkId: 'workspace-shape',
        kind: 'workspace-state',
        pass: false,
        score: 0,
        reason: 'Missing map.',
        evidence: {},
        metadata: {},
      },
    ],
    events,
    spans: [
      {
        traceId: 'trace-1',
        spanId: 'span-1',
        name: 'promptfoo-only-span',
        startTime: 1,
        attributes: {},
      },
    ],
    unknownMetadata: {},
  };
}

describe('observatory trajectory read model', () => {
  it('links explicit nested tool relationships without consuming spans', () => {
    const trajectory = createObservatoryTrajectory(
      run([
        {
          sequence: 0,
          timestamp: '2026-08-19T12:00:00.100Z',
          type: 'nested-agent',
          name: 'document-agent',
          data: {toolCallId: 'parent', state: 'complete'},
        },
        {
          sequence: 1,
          timestamp: '2026-08-19T12:00:00.200Z',
          type: 'tool',
          name: 'create_chart',
          data: {
            toolCallId: 'child',
            parentToolCallId: 'parent',
            durationMs: 42,
            input: {title: 'Metric'},
          },
        },
      ]),
    );

    expect(trajectory.graphRecommended).toBe(true);
    expect(trajectory.links).toContainEqual({
      sourceId: 'run-1:event:0',
      targetId: 'run-1:event:1',
      kind: 'parent',
    });
    expect(trajectory.nodes).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({label: 'promptfoo-only-span'}),
      ]),
    );
    expect(trajectory.nodes).toContainEqual(
      expect.objectContaining({
        id: 'run-1:event:1',
        durationMs: 42,
        data: expect.objectContaining({input: {title: 'Metric'}}),
      }),
    );
  });

  it('keeps simple runs in the ordered-list workflow', () => {
    const trajectory = createObservatoryTrajectory(
      run([
        {
          sequence: 0,
          timestamp: '2026-08-19T12:00:00.100Z',
          type: 'tool',
          name: 'list_tables',
          data: {},
        },
      ]),
    );

    expect(trajectory.graphRecommended).toBe(false);
    expect(trajectory.recommendationReason).toContain('ordered event list');
  });
});
