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
  relatedOracles,
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
        relatedOracleIds: [],
      },
    ],
    links: [],
  };
}

function runWithOracle(id: string, oracleId: string): ObservatoryRun {
  return {
    id,
    oracleResults: [
      {
        oracleId,
        kind: 'workspace-state',
        pass: true,
        score: 1,
        reason: `${oracleId} passed.`,
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

  it('uses each trajectory owner for its label and oracle evidence', () => {
    const selectedTrajectory = trajectory('selected', true);
    const baselineTrajectory = trajectory('baseline', true);
    selectedTrajectory.nodes[0]!.relatedOracleIds = ['selected-oracle'];
    baselineTrajectory.nodes[0]!.relatedOracleIds = ['baseline-oracle'];
    const selectedRun = runWithOracle('selected', 'selected-oracle');
    const baselineRun = runWithOracle('baseline', 'baseline-oracle');
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
    expect(relatedOracles(selectedMatch.node, selectedOwner?.run)).toEqual(
      selectedRun.oracleResults,
    );
    expect(baselineOwner?.label).toBe('Baseline');
    expect(relatedOracles(baselineMatch.node, baselineOwner?.run)).toEqual(
      baselineRun.oracleResults,
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
