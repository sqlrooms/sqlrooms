import {makeQualifiedTableName} from '@sqlrooms/duckdb';
import {CountPlotCategoryCountClient} from '../../src/charts/chart-types/count-plot/renderer/CountPlotCategoryCountClient';

describe('CountPlotCategoryCountClient', () => {
  it('builds a category count query that includes null as a category', () => {
    const client = new CountPlotCategoryCountClient({
      field: 'origin',
      onStateChange: () => {},
      table: makeQualifiedTableName({
        database: 'local',
        schema: 'main',
        table: 'cars',
        defaultDatabase: 'local',
      }),
    });

    const sql = client.query([]).toString();

    expect(sql).toContain('COUNT(DISTINCT "origin")');
    expect(sql).toContain(
      'COALESCE(MAX(CASE WHEN "origin" IS NULL THEN 1 ELSE 0 END), 0)',
    );
    expect(sql).toContain('FROM "main"."cars"');
    expect(sql).not.toContain('FROM "local"."main"."cars"');
  });

  it('publishes count state from query results', () => {
    let latest: any;
    const client = new CountPlotCategoryCountClient({
      field: 'origin',
      onStateChange: (state) => {
        latest = state;
      },
      table: makeQualifiedTableName({
        schema: 'main',
        table: 'cars',
      }),
    });

    client.queryResult({
      toArray: () => [{count: 3}],
    });

    expect(latest).toEqual({count: 3, isLoading: false});
  });
});
