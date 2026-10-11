import {describe, expect, it} from '@jest/globals';
import type {
  ObservatoryRun,
  ObservatoryTrajectory,
} from '@sqlrooms/evals/promptfoo/read-model';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  EventList,
  TrajectoryComparison,
  baselineIdAfterRunSelection,
  findTrajectoryNode,
  findTrajectoryNodeOwner,
  relatedChecks,
} from '../EvalObservatory';

function trajectory(
  runId: string,
  graphRecommended: boolean,
): ObservatoryTrajectory {
  return {
    runId,
    graphRecommended,
    recommendationReason: graphRecommended
      ? 'Delegation is present.'
      : 'The ordered event list is clearer.',
    nodes: [
      {
        id: `${runId}:run`,
        kind: 'run',
        label: runId,
        data: {},
        relatedCheckIds: [],
      },
    ],
    links: [],
  };
}

function runWithCheck(id: string, checkId: string): ObservatoryRun {
  return {
    id,
    checkResults: [
      {
        checkId,
        kind: 'workspace-state',
        pass: true,
        score: 1,
        reason: `${checkId} passed.`,
        evidence: {},
        metadata: {},
      },
    ],
  } as ObservatoryRun;
}

describe('EvalObservatory trajectory comparison', () => {
  it('clears a baseline only when selecting that baseline run', () => {
    expect(baselineIdAfterRunSelection('run-b', 'run-b')).toBeUndefined();
    expect(baselineIdAfterRunSelection('run-c', 'run-b')).toBe('run-c');
  });

  it('returns the owning trajectory for node IDs containing colons', () => {
    const selected = trajectory('foo', true);
    const baseline = trajectory('foo:bar', true);

    expect(findTrajectoryNode('foo:bar:run', selected, baseline)).toEqual({
      node: baseline.nodes[0],
      trajectory: baseline,
    });
  });

  it('uses each trajectory owner for its label and check evidence', () => {
    const selectedTrajectory = trajectory('selected', true);
    const baselineTrajectory = trajectory('baseline', true);
    selectedTrajectory.nodes[0]!.relatedCheckIds = ['selected-check'];
    baselineTrajectory.nodes[0]!.relatedCheckIds = ['baseline-check'];
    const selectedRun = runWithCheck('selected', 'selected-check');
    const baselineRun = runWithCheck('baseline', 'baseline-check');
    const selectedMatch = findTrajectoryNode(
      'selected:run',
      selectedTrajectory,
      baselineTrajectory,
    );
    const baselineMatch = findTrajectoryNode(
      'baseline:run',
      selectedTrajectory,
      baselineTrajectory,
    );
    if (!selectedMatch || !baselineMatch) {
      throw new Error('Expected both trajectory nodes.');
    }

    const selectedOwner = findTrajectoryNodeOwner(
      selectedMatch,
      selectedTrajectory,
      selectedRun,
      baselineRun,
    );
    const baselineOwner = findTrajectoryNodeOwner(
      baselineMatch,
      selectedTrajectory,
      selectedRun,
      baselineRun,
    );

    expect(selectedOwner?.label).toBe('Selected');
    expect(relatedChecks(selectedMatch.node, selectedOwner?.run)).toEqual(
      selectedRun.checkResults,
    );
    expect(baselineOwner?.label).toBe('Baseline');
    expect(relatedChecks(baselineMatch.node, baselineOwner?.run)).toEqual(
      baselineRun.checkResults,
    );
  });

  it('omits the selected graph when only the baseline recommends one', () => {
    const markup = renderToStaticMarkup(
      <TrajectoryComparison
        selected={trajectory('selected', false)}
        baseline={trajectory('baseline', true)}
        onSelectNode={() => undefined}
      />,
    );

    expect(markup).toContain('Graph omitted.');
    expect(markup).toContain('The ordered event list is clearer.');
    expect(markup).not.toContain('trajectory-canvas');
    expect(markup).not.toContain('Selected · selected');
  });

  it('exposes the selected event state semantically', () => {
    const selected = trajectory('selected', true);
    selected.nodes[0]!.sequence = 0;

    const markup = renderToStaticMarkup(
      <EventList
        trajectory={selected}
        selectedNodeId="selected:run"
        onSelectNode={() => undefined}
      />,
    );

    expect(markup).toContain('aria-pressed="true"');
  });
});
