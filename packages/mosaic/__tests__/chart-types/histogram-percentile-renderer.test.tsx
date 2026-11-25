/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import {jest} from '@jest/globals';
import {makeQualifiedTableName, type DataTable} from '@sqlrooms/duckdb';
import {act, render, screen} from '@testing-library/react';
import {type Coordinator} from '@uwdata/mosaic-core';
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

it('displays and reports a cutoff query failure as a SQL issue', async () => {
  const message = 'Cutoff query could not read requests';
  const query = jest
    .fn<() => Promise<never>>()
    .mockRejectedValue(new Error(message));
  const reportIssue = jest.fn();

  render(
    <HistogramPercentileRenderer
      config={{
        chartType: 'histogram',
        settings: {field: 'duration', upperPercentile: 99},
      }}
      coordinator={{query} as unknown as Coordinator}
      dataTable={dataTable}
      table={table}
      runtimeIssueContext={runtimeIssueContext}
      runtimeIssueReporter={{reportIssue, clearIssue: jest.fn()}}
    />,
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
  const view = (upperPercentile: number) => (
    <HistogramPercentileRenderer
      config={{
        chartType: 'histogram',
        settings: {field: 'duration', upperPercentile},
      }}
      coordinator={coordinator}
      dataTable={dataTable}
      table={table}
      runtimeIssueContext={runtimeIssueContext}
      runtimeIssueReporter={reporter}
    />
  );
  const {rerender} = render(view(99));
  rerender(view(90));
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
