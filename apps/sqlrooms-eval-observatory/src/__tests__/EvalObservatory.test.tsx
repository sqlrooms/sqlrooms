import {describe, expect, it} from '@jest/globals';
import type {ObservatoryTrajectory} from '@sqlrooms/evals/promptfoo/read-model';
import {renderToStaticMarkup} from 'react-dom/server';
import {
  TrajectoryComparison,
  baselineIdAfterRunSelection,
  findTrajectoryNode,
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
});
