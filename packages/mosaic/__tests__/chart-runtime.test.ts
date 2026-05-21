import {
  assertChartDataPolicy,
  createChartRuntimeIssueFromError,
  getQueryResultRowCount,
} from '../src/chart-runtime';
import {DataPointLimitError} from '../src/DataPointLimitError';

describe('chart runtime data policy helpers', () => {
  it('counts common query result shapes', () => {
    expect(getQueryResultRowCount([{x: 1}, {x: 2}])).toBe(2);
    expect(getQueryResultRowCount({numRows: 3})).toBe(3);
    expect(getQueryResultRowCount({toArray: () => [1, 2, 3, 4]})).toBe(4);
  });

  it('throws DataPointLimitError when result exceeds chart policy', () => {
    expect(() =>
      assertChartDataPolicy({maxRows: 2}, [{x: 1}, {x: 2}, {x: 3}]),
    ).toThrow(DataPointLimitError);
  });

  it('skips disabled policies and supports custom size estimators', () => {
    expect(() =>
      assertChartDataPolicy({disabled: true, maxRows: 1}, [{x: 1}, {x: 2}]),
    ).not.toThrow();

    expect(() =>
      assertChartDataPolicy({maxRows: 1, getResultSize: () => 2}, [{x: 1}]),
    ).toThrow(DataPointLimitError);
  });

  it('treats maxRows: 0 as a valid hard limit', () => {
    expect(() => assertChartDataPolicy({maxRows: 0}, [])).not.toThrow();

    expect(() => assertChartDataPolicy({maxRows: 0}, [{x: 1}])).toThrow(
      DataPointLimitError,
    );
  });

  it('creates AI-visible too-much-data issues from limit errors', () => {
    const issue = createChartRuntimeIssueFromError(
      new DataPointLimitError(12, 10),
      {panelId: 'panel-1', chartType: 'bubble-chart'},
      {reason: 'Use a heatmap instead.'},
    );

    expect(issue).toMatchObject({
      kind: 'too-much-data',
      panelId: 'panel-1',
      chartType: 'bubble-chart',
      recoverable: true,
      rowCount: 12,
      limit: 10,
    });
    expect(issue.message).toContain('Use a heatmap instead.');
  });
});
