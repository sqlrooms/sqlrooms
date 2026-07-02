import {makeQualifiedTableName, type DataTable} from '@sqlrooms/duckdb';
import {createCountPlotSpec} from '../../src/charts/chart-types/count-plot/spec';
import type {CountPlotChartSettings} from '../../src/charts/chart-types/count-plot/schema';

describe('createCountPlotSpec', () => {
  const mockDataTable: DataTable = {
    table: makeQualifiedTableName({
      database: 'attached',
      schema: 'main',
      table: 'roads',
    }),
    tableName: 'roads',
    schema: 'main',
    isView: false,
    columns: [
      {name: 'class', type: 'VARCHAR'},
      {name: 'length_m', type: 'DOUBLE'},
    ],
  };

  it('generates a count plot with auto-derived left margin by default', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
      selectionName: 'test_selection',
    }) as any;

    expect(spec.plot[0].x).toEqual({count: null});
    expect(spec.plot[0].y).toEqual({
      column: 'class',
      sort: {x: 'sum', order: 'desc', limit: 100},
    });
    expect(spec.xLabel).toBe('Count');
    expect(spec.margins.left).toBeGreaterThan(50);
  });

  it('applies ascending value sorting', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
      sort: 'value-asc',
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
    }) as any;

    expect(spec.plot[0].y.sort).toEqual({
      x: 'sum',
      order: 'asc',
      limit: 100,
    });
  });

  it('can sort categories by label', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
      sort: 'label-asc',
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
    }) as any;

    expect(spec.plot[0].y.sort).toEqual({
      y: 'min',
      order: 'asc',
      limit: 100,
    });
  });

  it('can aggregate a numeric value column', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
      metric: 'aggregate',
      valueField: 'length_m',
      aggregate: 'avg',
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
    }) as any;

    expect(spec.plot[0].x).toEqual({avg: 'length_m'});
    expect(spec.plot[2].text).toEqual({avg: 'length_m'});
    expect(spec.plot[0].y.sort).toEqual({
      x: 'avg',
      order: 'desc',
      limit: 100,
    });
    expect(spec.xLabel).toBe('AVG length_m');
  });

  it('uses manual left margin when provided', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
      leftMargin: 140,
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
    }) as any;

    expect(spec.margins.left).toBe(140);
  });
});
