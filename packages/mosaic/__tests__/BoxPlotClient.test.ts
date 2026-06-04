import {Selection, clausePoint} from '@uwdata/mosaic-core';
import {
  BoxPlotClient,
  buildBoxPlotQuery,
} from '../src/charts/chart-types/box-plot/renderer/BoxPlotClient';

describe('BoxPlotClient', () => {
  it('builds grouped box plot SQL with quantiles, whiskers, and outliers', () => {
    const sql = buildBoxPlotQuery({
      tableName: 'earthquakes',
      x: 'region',
      y: 'magnitude',
    });

    expect(sql).toContain('quantile_cont("value", 0.25)');
    expect(sql).toContain('quantile_cont("value", 0.5)');
    expect(sql).toContain('quantile_cont("value", 0.75)');
    expect(sql).toContain('"q1" - 1.5 * ("q3" - "q1")');
    expect(sql).toContain('"q3" + 1.5 * ("q3" - "q1")');
    expect(sql).toContain('MIN(b."value") AS "whiskerLow"');
    expect(sql).toContain('MAX(b."value") AS "whiskerHigh"');
    expect(sql).toContain('WHERE "magnitude" IS NOT NULL');
    expect(sql).toContain('b."value" < f."lowerFence"');
    expect(sql).toContain('UNION ALL');
  });

  it('applies external selection predicates to the box plot query', () => {
    const selection = Selection.crossfilter();
    selection.update(clausePoint('status', 'active', {source: {}}));
    const client = new BoxPlotClient({
      onStateChange: () => {},
      selection,
      tableName: 'events',
      x: 'kind',
      y: 'score',
    });

    const sql = client.query(selection.predicate(client) as any);

    expect(sql).toContain('"score" IS NOT NULL');
    expect(sql).toContain('"status"');
    expect(sql).toContain('active');
  });

  it('updates the shared selection when brushing the y axis', () => {
    const selection = Selection.crossfilter();
    let latestState: any;
    const client = new BoxPlotClient({
      onStateChange: (state) => {
        latestState = state;
      },
      selection,
      tableName: 'events',
      x: 'kind',
      y: 'score',
    });

    client.updateYBrush([10, 2]);

    expect(latestState.yBrush).toEqual([2, 10]);
    expect(selection.clauses.length).toBe(1);
    expect(selection.predicate({} as any)?.toString()).toContain('"score"');
    expect(selection.predicate(client)).toBeUndefined();

    client.updateYBrush();

    expect(latestState.yBrush).toBeUndefined();
    expect(selection.clauses.length).toBe(0);
  });

  it('normalizes query results into summaries and outliers', () => {
    let latestState: any;
    const client = new BoxPlotClient({
      onStateChange: (state) => {
        latestState = state;
      },
      selection: Selection.crossfilter(),
      tableName: 'events',
      x: 'kind',
      y: 'score',
    });

    client.queryResult({
      toArray: () => [
        {
          category: 'A',
          count: 4,
          lowerFence: -1,
          median: 2.5,
          q1: 1.5,
          q3: 3.5,
          rowKind: 'summary',
          upperFence: 6,
          whiskerHigh: 4,
          whiskerLow: 1,
        },
        {
          category: 'A',
          rowKind: 'outlier',
          value: 9,
        },
      ],
    });

    expect(latestState.isLoading).toBe(false);
    expect(latestState.summaries).toEqual([
      {
        category: 'A',
        count: 4,
        lowerFence: -1,
        median: 2.5,
        q1: 1.5,
        q3: 3.5,
        upperFence: 6,
        whiskerHigh: 4,
        whiskerLow: 1,
      },
    ]);
    expect(latestState.outliers).toEqual([{category: 'A', value: 9}]);
  });
});
