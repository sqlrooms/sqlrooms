/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import {jest} from '@jest/globals';
import {makeQualifiedTableName, type DataTable} from '@sqlrooms/duckdb';
import {act, render, screen} from '@testing-library/react';
import {type Coordinator} from '@uwdata/mosaic-core';
import {type ChartRuntimeIssueReporter} from '../../src/chart-runtime';
import {HistogramPercentileRenderer} from '../../src/charts/chart-types/histogram/HistogramPercentileRenderer';

const table = makeQualifiedTableName({schema: 'main', table: 'requests'});
const dataTable: DataTable = {
  table,
  tableName: 'requests',
  schema: 'main',
  isView: false,
  columns: [{name: 'duration', type: 'DOUBLE'}],
};
const runtimeIssueContext = {panelId: 'requests-plot', chartType: 'histogram'};

function histogram(
  coordinator: Coordinator,
  runtimeIssueReporter: ChartRuntimeIssueReporter,
  upperPercentile = 99,
) {
  return (
    <HistogramPercentileRenderer
      config={{
        chartType: 'histogram',
        settings: {field: 'duration', upperPercentile},
      }}
      coordinator={coordinator}
      dataTable={dataTable}
      table={table}
      runtimeIssueContext={runtimeIssueContext}
      runtimeIssueReporter={runtimeIssueReporter}
    />
  );
}

it('displays and reports a cutoff query failure as a SQL issue', async () => {
  const message = 'Cutoff query could not read requests';
  const query = jest
    .fn<() => Promise<never>>()
    .mockRejectedValue(new Error(message));
  const reportIssue = jest.fn();

  render(
    histogram({query} as unknown as Coordinator, {
      reportIssue,
      clearIssue: jest.fn(),
    }),
  );

  expect(await screen.findByText(message)).toBeTruthy();
  expect(reportIssue).toHaveBeenCalledTimes(1);
  expect(reportIssue).toHaveBeenCalledWith({
    ...runtimeIssueContext,
    kind: 'sql-error',
    message,
    recoverable: true,
  });
});

it('ignores a cutoff failure after the percentile changes', async () => {
  const first = Promise.withResolvers<never>();
  const second = Promise.withResolvers<never>();
  const query = jest
    .fn<() => Promise<never>>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const coordinator = {query} as unknown as Coordinator;
  const reportIssue = jest.fn();
  const reporter = {reportIssue, clearIssue: jest.fn()};
  const {rerender} = render(histogram(coordinator, reporter));
  rerender(histogram(coordinator, reporter, 90));
  expect(query).toHaveBeenCalledTimes(2);

  await act(async () => {
    first.reject(new Error('Superseded cutoff query'));
  });
  expect(reportIssue).not.toHaveBeenCalled();
  expect(screen.queryByText('Superseded cutoff query')).toBeNull();

  await act(async () => {
    second.reject(new Error('Current cutoff query'));
  });
  expect(reportIssue).toHaveBeenCalledTimes(1);
  expect(reportIssue).toHaveBeenCalledWith(
    expect.objectContaining({message: 'Current cutoff query'}),
  );
});

it('clears a cutoff issue when the current query succeeds with no finite values', async () => {
  const emptyCutoff = {get: () => ({upper_bound: null})};
  const superseded = Promise.withResolvers<typeof emptyCutoff>();
  const current = Promise.withResolvers<typeof emptyCutoff>();
  const query = jest
    .fn<() => Promise<typeof emptyCutoff>>()
    .mockRejectedValueOnce(new Error('Cutoff failed'))
    .mockReturnValueOnce(superseded.promise)
    .mockReturnValueOnce(current.promise);
  const coordinator = {query} as unknown as Coordinator;
  const reporter = {reportIssue: jest.fn(), clearIssue: jest.fn()};
  const {rerender} = render(histogram(coordinator, reporter));
  expect(await screen.findByText('Cutoff failed')).toBeTruthy();
  expect(reporter.reportIssue).toHaveBeenCalledTimes(1);

  rerender(histogram(coordinator, reporter, 90));
  rerender(histogram(coordinator, reporter, 80));
  await act(async () => {
    superseded.resolve(emptyCutoff);
  });
  expect(reporter.clearIssue).not.toHaveBeenCalled();

  await act(async () => {
    current.resolve(emptyCutoff);
  });
  expect(screen.getByRole('status').textContent).toBe(
    'No finite values to bin.',
  );
  expect(reporter.clearIssue).toHaveBeenCalledTimes(1);
});
