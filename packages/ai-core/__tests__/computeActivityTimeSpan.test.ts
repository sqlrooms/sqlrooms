import {
  computeActivityTimeSpan,
  computeComputationTimeMs,
  computeTimeSpan,
} from '../src/components/buildChatTurnModel';

const TIMINGS = {
  'tool-a': {startedAt: 1_000, completedAt: 3_000},
  'tool-b': {startedAt: 2_000, completedAt: 9_000},
  'tool-running': {startedAt: 5_000},
  'tool-unstarted': {completedAt: 7_000},
};

describe('computeActivityTimeSpan', () => {
  it('encloses every recorded call in the group', () => {
    expect(computeActivityTimeSpan(['tool-a', 'tool-b'], TIMINGS)).toEqual({
      startedAt: 1_000,
      endedAt: 9_000,
    });
  });

  it('reports only the calls it was asked about', () => {
    expect(computeActivityTimeSpan(['tool-a'], TIMINGS)).toEqual({
      startedAt: 1_000,
      endedAt: 3_000,
    });
  });

  it('ends a still-running call at its start, so the span never runs backwards', () => {
    expect(computeActivityTimeSpan(['tool-running'], TIMINGS)).toEqual({
      startedAt: 5_000,
      endedAt: 5_000,
    });
  });

  it('ignores calls with no recorded start', () => {
    expect(
      computeActivityTimeSpan(['tool-unstarted'], TIMINGS),
    ).toBeUndefined();
    expect(
      computeActivityTimeSpan(['tool-a', 'tool-unstarted'], TIMINGS),
    ).toEqual({startedAt: 1_000, endedAt: 3_000});
  });

  it('is undefined when nothing in the group was timed', () => {
    expect(computeActivityTimeSpan([], TIMINGS)).toBeUndefined();
    expect(computeActivityTimeSpan(['tool-missing'], TIMINGS)).toBeUndefined();
  });
});

describe('computeTimeSpan', () => {
  it('reads timing entries directly, for callers that hold no id map', () => {
    expect(computeTimeSpan(Object.values(TIMINGS))).toEqual({
      startedAt: 1_000,
      endedAt: 9_000,
    });
  });

  it('cannot be stretched by an end with no matching start', () => {
    // A partially recorded entry used to extend the end past every real call.
    expect(
      computeTimeSpan([
        {startedAt: 1_000, completedAt: 3_000},
        {completedAt: 99_000},
      ]),
    ).toEqual({startedAt: 1_000, endedAt: 3_000});
  });

  it('is undefined rather than negative when only an end was recorded', () => {
    expect(computeTimeSpan([{completedAt: 5_000}])).toBeUndefined();
  });

  it('skips missing entries', () => {
    expect(
      computeTimeSpan([undefined, {startedAt: 2_000, completedAt: 4_000}]),
    ).toEqual({startedAt: 2_000, endedAt: 4_000});
  });
});

describe('computeComputationTimeMs', () => {
  it('is the duration of the enclosing span', () => {
    expect(computeComputationTimeMs(['tool-a', 'tool-b'], TIMINGS)).toBe(8_000);
  });

  it('is zero for a call that has not finished yet', () => {
    expect(computeComputationTimeMs(['tool-running'], TIMINGS)).toBe(0);
  });

  it('is undefined when there is no span', () => {
    expect(computeComputationTimeMs(['tool-missing'], TIMINGS)).toBeUndefined();
  });
});
