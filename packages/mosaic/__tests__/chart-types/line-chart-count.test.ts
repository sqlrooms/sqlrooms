import {jest} from '@jest/globals';
import {astToESM, parseSpec} from '@uwdata/mosaic-spec';
import {makeQualifiedTableName, type DataTable} from '@sqlrooms/duckdb';
import {createLineChartSpec} from '../../src/charts/chart-types/line-chart/spec';
import {LineChartSettings} from '../../src/charts/chart-types/line-chart/schema';
import {lineChartChartType} from '../../src/charts/chart-types/line-chart/definition';
import {
  assertChartDataPolicy,
  resolveChartDataPolicy,
} from '../../src/chart-runtime';
import {DataPointLimitError} from '../../src/DataPointLimitError';
import {
  createLineChartAiTool,
  LineChartToolInput,
} from '../../src/charts/chart-types/line-chart/tool';

const events: DataTable = {
  tableName: 'events',
  table: makeQualifiedTableName({schema: 'main', table: 'events'}),
  columns: [
    {name: 'time', type: 'TIMESTAMP'},
    {name: 'event_id', type: 'VARCHAR'},
    {name: 'amount', type: 'DOUBLE'},
  ],
};
const countSettings = {
  x: 'time',
  xInterval: 'month' as const,
  metric: 'count' as const,
};

describe('line-chart row counts', () => {
  it.each([
    {x: 'time'},
    {x: 'amount'},
    {x: 'time', xInterval: 'month' as const},
  ])('limits count result points, not source rows: %j', (settings) => {
    const policy = lineChartChartType.getDataPolicy?.({
      tableName: 'events',
      config: {
        chartType: 'line-chart',
        settings: {...settings, metric: 'count', showLegend: true},
      },
    });
    expect(policy).toMatchObject({maxRows: 10_000});
    expect(() => assertChartDataPolicy(policy, {numRows: 10_001})).toThrow(
      DataPointLimitError,
    );
    expect(() =>
      assertChartDataPolicy(policy, {numRows: 10_000}),
    ).not.toThrow();
    // Any number of source observations can aggregate into a small result.
    expect(() =>
      assertChartDataPolicy(policy, [{x: 1, y: 100_000}]),
    ).not.toThrow();
  });

  it('preserves the legacy numeric-series data policies', () => {
    expect(
      lineChartChartType.getDataPolicy?.({
        tableName: 'events',
        config: {
          chartType: 'line-chart',
          settings: {
            x: 'time',
            yFields: [{field: 'amount', aggregate: 'sum'}],
            showLegend: true,
          },
        },
      }),
    ).toMatchObject({maxRows: 10_000});
    expect(
      lineChartChartType.getDataPolicy?.({
        tableName: 'events',
        config: {
          chartType: 'line-chart',
          settings: {
            x: 'time',
            xInterval: 'month',
            yFields: [{field: 'amount', aggregate: 'sum'}],
            showLegend: true,
          },
        },
      }),
    ).toBeNull();
  });
  it('accepts row counts without inventing a numeric Y field', () => {
    expect(
      LineChartToolInput.safeParse({
        tableName: 'events',
        reasoning: 'Count events by month.',
        settings: countSettings,
      }).success,
    ).toBe(true);
    expect(LineChartSettings.parse(countSettings)).toMatchObject(countSettings);
  });

  it('compiles row counts to zero-argument count, including rows with null IDs', () => {
    const spec = createLineChartSpec({
      dataTable: events,
      settings: {...countSettings, showLegend: false},
    });
    expect(spec).toMatchObject({
      yLabel: 'Count',
      colorDomain: ['Count'],
      plot: [
        {
          mark: 'lineY',
          data: {from: '"main"."events"', filterBy: '$brush'},
          x: {bin: 'time', interval: 'month'},
          y: {count: null},
        },
      ],
    });
    // Compile through Mosaic, not a hand-written evaluator of the settings.
    const code = astToESM(parseSpec(spec));
    expect(code).toContain('count()');
    expect(code).not.toContain('sum(');
    expect(code).not.toContain('event_id');
  });

  it('counts by the exact X value when no temporal interval is selected', () => {
    const spec = createLineChartSpec({
      dataTable: events,
      settings: {x: 'time', metric: 'count', showLegend: false},
    });
    expect(spec).toMatchObject({plot: [{x: 'time', y: {count: null}}]});
  });

  it('preserves the existing numeric aggregate path when metric is omitted', () => {
    const spec = createLineChartSpec({
      dataTable: events,
      settings: {
        x: 'time',
        xInterval: 'month',
        yFields: [{field: 'amount', aggregate: 'avg'}],
        showLegend: false,
      },
    });
    expect(spec).toMatchObject({plot: [{y: {avg: 'amount'}}]});
  });

  it('creates a count chart with the same settings the renderer consumes', async () => {
    const addChart = jest.fn(async () => 'chart-1');
    const tool = createLineChartAiTool({
      databaseAdapter: {getTables: () => [events], findTable: () => events},
      addChart,
      maxDataPoints: 10_000,
    });
    const result = await (tool as any).execute({
      tableName: 'events',
      settings: countSettings,
    });
    expect(result.success).toBe(true);
    expect(addChart).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          chartType: 'line-chart',
          settings: {...countSettings, showLegend: true},
          dataPolicy: {maxRows: 10_000},
        },
      }),
    );
  });

  it.each([500, 25_000])(
    'persists the host count-result limit in the rendered config: %i',
    async (maxDataPoints) => {
      const addChart = jest.fn(async () => 'chart-1');
      const tool = createLineChartAiTool({
        databaseAdapter: {getTables: () => [events], findTable: () => events},
        addChart,
        maxDataPoints,
      });
      const result = await (tool as any).execute({
        tableName: 'events',
        settings: countSettings,
      });
      expect(result).toMatchObject({
        success: true,
        data: {dataPolicy: {maxRows: maxDataPoints}},
      });
      const config = addChart.mock.calls[0]![0].config;
      const defaultPolicy = lineChartChartType.getDataPolicy?.({
        tableName: 'events',
        config,
      });
      const resolvedPolicy = resolveChartDataPolicy(
        defaultPolicy,
        config.dataPolicy,
      );
      expect(resolvedPolicy).toMatchObject({
        maxRows: maxDataPoints,
      });
      expect(() =>
        assertChartDataPolicy(resolvedPolicy, {numRows: maxDataPoints}),
      ).not.toThrow();
      expect(() =>
        assertChartDataPolicy(resolvedPolicy, {numRows: maxDataPoints + 1}),
      ).toThrow(DataPointLimitError);
    },
  );

  it.each([
    {x: 'amount', xInterval: 'month' as const, metric: 'count' as const},
    {
      x: 'amount',
      xInterval: 'month' as const,
      metric: 'aggregate' as const,
      yFields: [{field: 'amount', aggregate: 'sum' as const}],
    },
  ])('rejects a temporal interval on a numeric axis: %j', (settings) => {
    expect(() => createLineChartSpec({dataTable: events, settings})).toThrow(
      'xInterval',
    );
  });

  it('rejects a temporal interval on a numeric count axis through the tool', async () => {
    const addChart = jest.fn(async () => 'chart-1');
    const tool = createLineChartAiTool({
      databaseAdapter: {getTables: () => [events], findTable: () => events},
      addChart,
      maxDataPoints: 10_000,
    });
    expect(
      await (tool as any).execute({
        tableName: 'events',
        settings: {
          x: 'amount',
          xInterval: 'month',
          metric: 'count',
        },
      }),
    ).toMatchObject({
      success: false,
      errorMessage: expect.stringContaining('xInterval'),
    });
    expect(addChart).not.toHaveBeenCalled();
  });

  it('rejects contradictory count plus numeric series instead of ignoring them', async () => {
    const addChart = jest.fn(async () => 'chart-1');
    const tool = createLineChartAiTool({
      databaseAdapter: {getTables: () => [events], findTable: () => events},
      addChart,
      maxDataPoints: 10_000,
    });
    const result = await (tool as any).execute({
      tableName: 'events',
      settings: {
        ...countSettings,
        yFields: [{field: 'amount', aggregate: 'sum'}],
      },
    });
    expect(result).toMatchObject({
      success: false,
      errorMessage: expect.stringContaining('yFields'),
    });
    expect(addChart).not.toHaveBeenCalled();
  });

  it('keeps a single count legend entry and the brush interaction', () => {
    const spec = createLineChartSpec({
      dataTable: events,
      settings: countSettings,
      selectionName: 'linked-document',
    }) as any;
    expect(spec.vconcat[0].colorDomain).toEqual(['Count']);
    expect(spec.vconcat[0].plot).toContainEqual({
      select: 'intervalX',
      as: '$brush',
    });
    expect(spec.vconcat[1]).toMatchObject({legend: 'color', columns: 1});
  });

  it.each([
    {x: undefined, metric: 'count'},
    {x: 'missing', metric: 'count'},
    {x: 'event_id', metric: 'count'},
    {x: 'time', metric: 'aggregate'},
    {x: 'time', metric: 'unsupported'},
  ])(
    'rejects invalid settings without creating a chart: %j',
    async (settings) => {
      const addChart = jest.fn(async () => 'chart-1');
      const tool = createLineChartAiTool({
        databaseAdapter: {getTables: () => [events], findTable: () => events},
        addChart,
        maxDataPoints: 10_000,
      });
      expect(
        await (tool as any).execute({tableName: 'events', settings}),
      ).toMatchObject({success: false});
      expect(addChart).not.toHaveBeenCalled();
    },
  );
});
