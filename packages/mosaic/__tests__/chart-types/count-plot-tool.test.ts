import {jest} from '@jest/globals';
import {makeQualifiedTableName, type DataTable} from '@sqlrooms/duckdb';
import {
  CountPlotToolInput,
  createCountPlotAiTool,
} from '../../src/charts/chart-types/count-plot/tool';
import type {DatabaseAiAdapter} from '../../src/ai/database-types';

describe('count plot AI tool', () => {
  const rawTable: DataTable = {
    tableName: 'venues',
    table: makeQualifiedTableName({schema: 'main', table: 'venues'}),
    columns: [
      {name: 'category', type: 'VARCHAR'},
      {name: 'venue_id', type: 'VARCHAR'},
    ],
  };

  const summarizedTable: DataTable = {
    tableName: 'category_breakdown',
    table: makeQualifiedTableName({
      schema: 'main',
      table: 'category_breakdown',
    }),
    columns: [
      {name: 'category', type: 'VARCHAR'},
      {name: 'venue_count', type: 'BIGINT'},
    ],
  };

  function createDatabaseAdapter(): DatabaseAiAdapter {
    return {
      getTables: () => [rawTable, summarizedTable],
      findTable: (tableName) =>
        [rawTable, summarizedTable].find(
          (table) => table.tableName === String(tableName),
        ),
    };
  }

  it('accepts provider-friendly flat settings without unrelated required fields', () => {
    const commonInput = {
      tableName: 'venues',
      reasoning: 'Show the category breakdown.',
    };

    expect(
      CountPlotToolInput.safeParse({
        ...commonInput,
        settings: {field: 'category', metric: 'count'},
      }).success,
    ).toBe(true);
    expect(
      CountPlotToolInput.safeParse({
        ...commonInput,
        settings: {field: 'category'},
      }).success,
    ).toBe(true);
    expect(
      CountPlotToolInput.safeParse({
        ...commonInput,
        settings: {field: 'category', metric: 'aggregate'},
      }).success,
    ).toBe(true);
    expect(
      CountPlotToolInput.safeParse({
        ...commonInput,
        settings: {
          field: 'category',
          metric: 'aggregate',
          valueField: 'venue_count',
        },
      }).success,
    ).toBe(true);
  });

  it('returns an actionable result when aggregate mode lacks a value field', async () => {
    const addChart = jest.fn(async () => 'chart-1');
    const countPlotTool = createCountPlotAiTool({
      addChart,
      databaseAdapter: createDatabaseAdapter(),
      maxDataPoints: 10_000,
    });

    const result = await (countPlotTool as any).execute({
      tableName: 'category_breakdown',
      reasoning: 'The table is summarized by category.',
      settings: {field: 'category', metric: 'aggregate'},
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        errorMessage: expect.stringContaining('Value field'),
      }),
    );
    expect(addChart).not.toHaveBeenCalled();
  });

  it('creates a row-count chart for repeated raw observations', async () => {
    const addChart = jest.fn(async () => 'chart-1');
    const countPlotTool = createCountPlotAiTool({
      addChart,
      databaseAdapter: createDatabaseAdapter(),
      maxDataPoints: 10_000,
    });

    const result = await (countPlotTool as any).execute({
      tableName: 'venues',
      reasoning: 'Each venue row is an observation.',
      settings: {field: 'category', metric: 'count'},
    });

    expect(result.success).toBe(true);
    expect(addChart).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'venues',
        config: expect.objectContaining({
          chartType: 'count-plot',
          settings: expect.objectContaining({
            field: 'category',
            metric: 'count',
          }),
        }),
      }),
    );
  });

  it('creates an aggregate chart for an existing summarized measure', async () => {
    const addChart = jest.fn(async () => 'chart-1');
    const countPlotTool = createCountPlotAiTool({
      addChart,
      databaseAdapter: createDatabaseAdapter(),
      maxDataPoints: 10_000,
    });

    const result = await (countPlotTool as any).execute({
      tableName: 'category_breakdown',
      reasoning:
        'The table is already summarized to one row per category and venue_count is the measure.',
      settings: {
        field: 'category',
        metric: 'aggregate',
        valueField: 'venue_count',
        aggregate: 'sum',
      },
    });

    expect(result.success).toBe(true);
    expect(addChart).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'category_breakdown',
        config: expect.objectContaining({
          chartType: 'count-plot',
          settings: expect.objectContaining({
            field: 'category',
            metric: 'aggregate',
            valueField: 'venue_count',
            aggregate: 'sum',
          }),
        }),
      }),
    );
  });
});
